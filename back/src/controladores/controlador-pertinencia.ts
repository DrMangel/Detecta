import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import {
  UNIDAD_TRABAJO,
  type UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import {
  RELOJ,
  type Reloj,
} from '../aplicacion/servicios/servicio-autenticacion';
import { ServicioNotificacion } from '../aplicacion/servicios/servicio-notificacion';
import type { CasoRiesgo } from '../dominio/entidades/caso-riesgo';
import { EstadoCaso } from '../dominio/entidades/estado-caso';
import { Modalidad } from '../dominio/entidades/modalidad';
import type { Persona } from '../dominio/entidades/persona';
import { Psicologo } from '../dominio/entidades/psicologo';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import { ControladorBase } from './controlador-base';
import { conPersistencia, regla } from './respuestas';
import { citaDto, type CitaDto } from './respuestas-casos';
import { UsuarioSesion } from './sesion';
import {
  leerBooleano,
  leerCuerpo,
  leerEnumerado,
  leerFechaHoraFutura,
  leerTexto,
  LONGITUD_MAXIMA,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

/** Mensajes transcritos de sd_CUD06 (CUD07) y textos del dominio y del plan. */
export const MENSAJES_PERTINENCIA = {
  tomadoPorOtro: 'El caso ya fue tomado por otro psicólogo',
  archivadoReorientado: 'Caso archivado / reorientado',
  aprobado: 'Caso aprobado. Programe la cita',
  cruceHorario: 'Cruce de horario. Seleccione otra hora',
  requiereConsentimiento:
    'La atención requiere el consentimiento informado del acudiente',
  citaProgramada: 'Cita programada',
  /** sd_CUD06, *.a (transcrito por Ivan). */
  errorExpediente: 'Error al registrar la información del expediente',
  /** Mensaje del dominio (CasoRiesgo, B1). */
  justificacion: 'Registre la justificación',
  /** Texto nuevo (pendiente de aprobación): el caso ya pasó la evaluación. */
  yaEvaluado: 'El caso ya fue evaluado.',
} as const;

const MODALIDADES = Object.values(Modalidad);
/** Estados en los que el caso aún admite el dictamen (CUD07, 1.a). */
const ESTADOS_EVALUABLES: readonly EstadoCaso[] = [
  EstadoCaso.PENDIENTE,
  EstadoCaso.EN_EVALUACION,
];

/**
 * Controlador `ControladorPertinencia` (diagrama de clases v3; R05; CUD07
 * dentro de sd_CUD06). Escrituras en una transacción con bloqueo con espera
 * del caso (y de la agenda del psicólogo al programar), recargando dentro.
 */
@Controller('pertinencia')
export class ControladorPertinencia extends ControladorBase {
  readonly #registro = new Logger('ControladorPertinencia');

  constructor(
    controlAcceso: ControlAcceso,
    @Inject(UNIDAD_TRABAJO)
    private readonly unidadTrabajo: UnidadTrabajo,
    private readonly notificacion: ServicioNotificacion,
    @Inject(RELOJ)
    private readonly reloj: Reloj,
  ) {
    super(controlAcceso);
  }

  /**
   * POST /pertinencia/:idCaso {pertinente, justificacion, reorientar?}
   * (sd_CUD06, CUD07). `reorientar` (fuera del diagrama, respuesta 6) solo
   * vale con `pertinente = false`; la justificación es obligatoria.
   */
  @Post(':idCaso')
  @HttpCode(200)
  async evaluarPertinencia(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
    @Body() cuerpo: unknown,
  ): Promise<{ mensaje: string; estado: EstadoCaso }> {
    const psicologo = this.#psicologo(usuario, 'evaluarPertinencia');
    const campos = leerCuerpo(cuerpo, [
      'pertinente',
      'justificacion',
      'reorientar',
    ]);
    const pertinente = leerBooleano(campos, 'pertinente');
    const reorientar = leerBooleano(campos, 'reorientar') ?? false;
    const justificacion = leerTexto(
      campos,
      'justificacion',
      LONGITUD_MAXIMA.descripcion,
    );
    if (pertinente === null || (pertinente && reorientar)) {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }
    if (justificacion === '') {
      throw new BadRequestException(MENSAJES_PERTINENCIA.justificacion);
    }
    this.#exigirId(idCaso);

    const caso = await conPersistencia(
      this.#registro,
      MENSAJES_PERTINENCIA.errorExpediente,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = await repos.casos.buscarPorId(idCaso);
            if (
              recargado === null ||
              recargado.ruta !== RutaAtencion.PSICOLOGICA
            ) {
              throw new ForbiddenException();
            }
            if (
              recargado.psicologo !== null &&
              recargado.psicologo.id !== psicologo.id
            ) {
              throw new ConflictException(MENSAJES_PERTINENCIA.tomadoPorOtro);
            }
            if (!ESTADOS_EVALUABLES.includes(recargado.estado)) {
              throw new ConflictException(MENSAJES_PERTINENCIA.yaEvaluado);
            }
            if (!recargado.asignarPsicologo(psicologo)) {
              throw new ConflictException(MENSAJES_PERTINENCIA.tomadoPorOtro);
            }
            regla(() => {
              if (!pertinente) {
                if (reorientar) {
                  recargado.reorientar(justificacion);
                } else {
                  recargado.archivar(justificacion);
                }
              } else {
                recargado.aprobar();
              }
            });
            await repos.casos.guardar(recargado);
            return recargado;
          },
          { bloqueos: [`caso:${idCaso}`] },
        ),
    );
    return {
      mensaje: pertinente
        ? MENSAJES_PERTINENCIA.aprobado
        : MENSAJES_PERTINENCIA.archivadoReorientado,
      estado: caso.estado,
    };
  }

  /**
   * POST /pertinencia/:idCaso/citas {fechaHora, modalidad} → 201
   * (sd_CUD06, CUD07 pasos 3 a 6). Bloqueo del caso y después de la agenda
   * del psicólogo (orden fijo, ajuste B). Correo al estudiante (D26) después
   * del commit, sin esperarlo.
   */
  @Post(':idCaso/citas')
  @HttpCode(201)
  async programarCita(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
    @Body() cuerpo: unknown,
  ): Promise<{ mensaje: string; cita: CitaDto; aviso?: string }> {
    const psicologo = this.#psicologo(usuario, 'programarCita');
    const ahora = this.reloj();
    const campos = leerCuerpo(cuerpo, ['fechaHora', 'modalidad']);
    const fechaHora = leerFechaHoraFutura(campos, 'fechaHora', ahora);
    const modalidad = leerEnumerado(campos, 'modalidad', MODALIDADES);
    if (modalidad === null) {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }
    this.#exigirId(idCaso);

    const { caso, cita, requiere } = await conPersistencia(
      this.#registro,
      MENSAJES_PERTINENCIA.errorExpediente,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = await repos.casos.buscarPorId(idCaso);
            const asignado = this.#asignadoA(recargado, psicologo);
            if (asignado.estado !== EstadoCaso.EN_EVALUACION) {
              throw new ConflictException(MENSAJES_PERTINENCIA.yaEvaluado);
            }
            // El psicólogo del caso se recargó con su agenda dentro de la
            // transacción (bloqueada): la verificación del cruce es fresca.
            if (!asignado.psicologo?.estaDisponible(fechaHora)) {
              throw new ConflictException(MENSAJES_PERTINENCIA.cruceHorario);
            }
            const nueva = regla(() =>
              asignado.programarCita(fechaHora, modalidad),
            );
            await repos.casos.guardar(asignado);
            await repos.citas.guardar(nueva);
            return {
              caso: asignado,
              cita: nueva,
              requiere: asignado.requiereConsentimiento(ahora),
            };
          },
          { bloqueos: [`caso:${idCaso}`, `agenda:${psicologo.id}`] },
        ),
    );

    void this.notificacion.notificarCita(
      cita,
      caso.obtenerEstudiante(),
      requiere,
    );
    return {
      mensaje: MENSAJES_PERTINENCIA.citaProgramada,
      cita: citaDto(cita),
      ...(requiere
        ? { aviso: MENSAJES_PERTINENCIA.requiereConsentimiento }
        : {}),
    };
  }

  /** Caso de la ruta psicológica asignado al psicólogo de la sesión (D19). */
  #asignadoA(caso: CasoRiesgo | null, psicologo: Psicologo): CasoRiesgo {
    if (
      caso === null ||
      caso.ruta !== RutaAtencion.PSICOLOGICA ||
      caso.psicologo?.id !== psicologo.id
    ) {
      throw new ForbiddenException();
    }
    return caso;
  }

  #exigirId(id: string): void {
    if (id.length > LONGITUD_MAXIMA.identificador) {
      throw new ForbiddenException();
    }
  }

  #psicologo(usuario: Persona, accion: string): Psicologo {
    if (
      !this.verificarPermiso(usuario, accion) ||
      !(usuario instanceof Psicologo)
    ) {
      throw new ForbiddenException();
    }
    return usuario;
  }
}
