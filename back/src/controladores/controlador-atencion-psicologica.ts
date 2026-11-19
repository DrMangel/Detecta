import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { TipoEventoCaso } from '../aplicacion/contratos/registro-eventos-caso';
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
import type { Cita } from '../dominio/entidades/cita';
import { Modalidad } from '../dominio/entidades/modalidad';
import type { Persona } from '../dominio/entidades/persona';
import { Psicologo } from '../dominio/entidades/psicologo';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import { TipoAsesoria } from '../dominio/entidades/tipo-asesoria';
import type { RepositorioCasoRiesgo } from '../dominio/repositorios/repositorio-caso-riesgo';
import type { RepositorioRegistroAcademico } from '../dominio/repositorios/repositorio-registro-academico';
import {
  REPOSITORIO_CASO_RIESGO,
  REPOSITORIO_REGISTRO_ACADEMICO,
} from '../dominio/repositorios/tokens';
import { ControladorBase } from './controlador-base';
import { MENSAJES_PERTINENCIA } from './controlador-pertinencia';
import { conPersistencia, MENSAJE_ERROR_CONSULTA, regla } from './respuestas';
import {
  antecedentes,
  casoPsicologo,
  citaDto,
  type CasoPsicologoDto,
  type CitaDto,
  type DetalleDto,
} from './respuestas-casos';
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

/** Mensajes transcritos de sd_CUD06 (CUD08, CUD09, 6.b) y del plan de B7. */
export const MENSAJES_ATENCION = {
  sinConsentimiento: 'No se puede registrar la atención sin consentimiento',
  preguntaConsentimiento: '¿El acudiente otorgó el consentimiento informado?',
  resultadoRegistrado: 'Resultado registrado',
  observacionesVacias: 'Diligencie las observaciones de la asesoría',
  casoCerrado: 'Caso cerrado',
  /** Texto nuevo aprobado (respuesta 9). */
  noRequiereConsentimiento:
    'El estudiante no requiere consentimiento informado.',
} as const;

const MODALIDADES = Object.values(Modalidad);
const TIPOS = Object.values(TipoAsesoria);
/** Límite técnico de observaciones y acuerdos (columnas `text`). */
const LONGITUD_TEXTO_ASESORIA = LONGITUD_MAXIMA.descripcion;

/**
 * Controlador `ControladorAtencionPsicologica` (diagrama de clases v3; R06;
 * sd_CUD06 con CUD08 y CUD09). Solo el psicólogo asignado opera sobre el
 * caso (D19). Escrituras con bloqueo con espera del caso (y de la agenda al
 * programar o reprogramar), recargando dentro de la transacción.
 */
@Controller('atencion')
export class ControladorAtencionPsicologica extends ControladorBase {
  readonly #registro = new Logger('ControladorAtencionPsicologica');

  constructor(
    controlAcceso: ControlAcceso,
    @Inject(REPOSITORIO_CASO_RIESGO)
    private readonly casos: RepositorioCasoRiesgo,
    @Inject(REPOSITORIO_REGISTRO_ACADEMICO)
    private readonly registros: RepositorioRegistroAcademico,
    @Inject(UNIDAD_TRABAJO)
    private readonly unidadTrabajo: UnidadTrabajo,
    private readonly notificacion: ServicioNotificacion,
    @Inject(RELOJ)
    private readonly reloj: Reloj,
  ) {
    super(controlAcceso);
  }

  /**
   * GET /atencion/casos (sd_CUD06): casos por evaluar (ruta psicológica sin
   * psicólogo) y los asignados al psicólogo de la sesión.
   */
  @Get('casos')
  async listarCasosPsicologo(
    @UsuarioSesion() usuario: Persona,
  ): Promise<CasoPsicologoDto[]> {
    const psicologo = this.#psicologo(usuario, 'listarCasosPsicologo');
    const ahora = this.reloj();
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () => {
      const porEvaluar = await this.casos.listarPendientesRutaPsicologica();
      const asignados = await this.casos.listarPorPsicologo(psicologo.id);
      const vistos = new Set<string>();
      return [...porEvaluar, ...asignados]
        .filter((caso) => {
          const nuevo = !vistos.has(caso.idCaso);
          vistos.add(caso.idCaso);
          return (
            nuevo &&
            this.controlAcceso.puedeVerContenidoConfidencial(psicologo, caso)
          );
        })
        .map((caso) => casoPsicologo(caso, ahora));
    });
  }

  /**
   * GET /atencion/casos/:idCaso (fuera del diagrama, respuesta 5): expediente
   * con antecedentes académicos; solo si el psicólogo puede verlo (D19).
   */
  @Get('casos/:idCaso')
  async consultarCaso(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
  ): Promise<DetalleDto<CasoPsicologoDto>> {
    const psicologo = this.#psicologo(usuario, 'listarCasosPsicologo');
    this.#exigirId(idCaso);
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () => {
      const caso = await this.casos.buscarPorId(idCaso);
      if (
        caso === null ||
        !this.controlAcceso.puedeVerContenidoConfidencial(psicologo, caso)
      ) {
        throw new ForbiddenException();
      }
      const registros = await this.registros.listar(
        new Map([['idEstudiante', caso.obtenerEstudiante().id]]),
      );
      return {
        caso: casoPsicologo(caso, this.reloj()),
        antecedentes: antecedentes(registros),
      };
    });
  }

  /**
   * POST /atencion/citas/:idCita/reprogramacion {fechaHora, modalidad}
   * (sd_CUD06, 4.a). Ajuste D: 400 solo si fecha, hora y modalidad son
   * idénticas; el cruce excluye la propia cita.
   */
  @Post('citas/:idCita/reprogramacion')
  @HttpCode(200)
  async reprogramarCita(
    @UsuarioSesion() usuario: Persona,
    @Param('idCita') idCita: string,
    @Body() cuerpo: unknown,
  ): Promise<{ cita: CitaDto }> {
    const psicologo = this.#psicologo(usuario, 'reprogramarCita');
    const ahora = this.reloj();
    const { fechaHora, modalidad } = this.#leerCita(cuerpo, ahora);
    this.#exigirId(idCita);
    // La cita no conoce su caso: se busca entre los casos del psicólogo.
    const idCaso = await conPersistencia(
      this.#registro,
      MENSAJES_PERTINENCIA.errorExpediente,
      async () =>
        (await this.casos.listarPorPsicologo(psicologo.id)).find((caso) =>
          caso.citas.some((cita) => cita.idCita === idCita),
        )?.idCaso,
    );
    if (idCaso === undefined) {
      throw new ForbiddenException();
    }

    const { caso, cita } = await conPersistencia(
      this.#registro,
      MENSAJES_PERTINENCIA.errorExpediente,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = this.#asignadoA(
              await repos.casos.buscarPorId(idCaso),
              psicologo,
            );
            const actual = this.#citaDe(recargado, idCita);
            const mismaFecha =
              actual.fechaHora.getTime() === fechaHora.getTime();
            if (mismaFecha && actual.modalidad === modalidad) {
              throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
            }
            // Con la misma fecha, el único "cruce" sería la propia cita.
            if (
              !mismaFecha &&
              !recargado.psicologo?.estaDisponible(fechaHora)
            ) {
              throw new ConflictException(MENSAJES_PERTINENCIA.cruceHorario);
            }
            // B9, trazabilidad: la fecha y la modalidad anteriores se
            // capturan antes de reprogramar (la cita las sobrescribe).
            const fechaHoraAnterior = actual.fechaHora;
            const modalidadAnterior = actual.modalidad;
            regla(() => actual.reprogramar(fechaHora, modalidad));
            await repos.citas.guardar(actual);
            await repos.eventos.registrar({
              tipo: TipoEventoCaso.CITA_REPROGRAMADA,
              idCaso,
              idActor: psicologo.id,
              idCita,
              fechaHoraAnterior,
              fechaHoraNueva: fechaHora,
              modalidadAnterior,
              modalidadNueva: modalidad,
            });
            return { caso: recargado, cita: actual };
          },
          { bloqueos: [`caso:${idCaso}`, `agenda:${psicologo.id}`] },
        ),
    );
    void this.notificacion.notificarCita(
      cita,
      caso.obtenerEstudiante(),
      caso.requiereConsentimiento(ahora),
    );
    return { cita: citaDto(cita) };
  }

  /**
   * POST /atencion/casos/:idCaso/citas/:idCita/resultado → 201 (CUD08).
   * R06: con un menor sin consentimiento confirmado se bloquea el registro
   * (409 con la marca `requiereConsentimiento` para que el front muestre la
   * pregunta de CUD09).
   */
  @Post('casos/:idCaso/citas/:idCita/resultado')
  @HttpCode(201)
  async registrarResultado(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
    @Param('idCita') idCita: string,
    @Body() cuerpo: unknown,
  ): Promise<{ mensaje: string; cita: CitaDto }> {
    const psicologo = this.#psicologo(usuario, 'registrarResultado');
    const campos = leerCuerpo(cuerpo, [
      'tipo',
      'observaciones',
      'acuerdos',
      'asistencia',
      'requiereSeguimiento',
      'presentaRiesgoCritico',
    ]);
    const tipo = leerEnumerado(campos, 'tipo', TIPOS);
    const observaciones = leerTexto(
      campos,
      'observaciones',
      LONGITUD_TEXTO_ASESORIA,
    );
    const acuerdos = leerTexto(campos, 'acuerdos', LONGITUD_TEXTO_ASESORIA);
    const asistencia = leerBooleano(campos, 'asistencia');
    const requiereSeguimiento = leerBooleano(campos, 'requiereSeguimiento');
    const presentaRiesgoCritico = leerBooleano(campos, 'presentaRiesgoCritico');
    if (
      tipo === null ||
      asistencia === null ||
      requiereSeguimiento === null ||
      presentaRiesgoCritico === null
    ) {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }
    this.#exigirId(idCaso);
    this.#exigirId(idCita);
    const ahora = this.reloj();

    const cita = await conPersistencia(
      this.#registro,
      MENSAJES_PERTINENCIA.errorExpediente,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = this.#asignadoA(
              await repos.casos.buscarPorId(idCaso),
              psicologo,
            );
            const actual = this.#citaDe(recargado, idCita);
            if (!recargado.habilitadoParaAtencion(ahora)) {
              throw new ConflictException({
                statusCode: 409,
                message: MENSAJES_ATENCION.sinConsentimiento,
                requiereConsentimiento: true,
                pregunta: MENSAJES_ATENCION.preguntaConsentimiento,
              });
            }
            const asesoria = regla(() =>
              actual.generarAsesoria(
                tipo,
                observaciones,
                acuerdos,
                asistencia,
                requiereSeguimiento,
                presentaRiesgoCritico,
              ),
            );
            await repos.citas.guardar(actual);
            await repos.asesorias.guardar(asesoria);
            return actual;
          },
          { bloqueos: [`caso:${idCaso}`] },
        ),
    );
    return {
      mensaje: MENSAJES_ATENCION.resultadoRegistrado,
      cita: citaDto(cita),
    };
  }

  /** POST /atencion/casos/:idCaso/consentimiento (CUD09). */
  @Post('casos/:idCaso/consentimiento')
  @HttpCode(200)
  async confirmarConsentimiento(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
  ): Promise<{ consentimientoConfirmado: boolean }> {
    const psicologo = this.#psicologo(usuario, 'confirmarConsentimiento');
    this.#exigirId(idCaso);
    const ahora = this.reloj();
    await conPersistencia(
      this.#registro,
      MENSAJES_PERTINENCIA.errorExpediente,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = this.#asignadoA(
              await repos.casos.buscarPorId(idCaso),
              psicologo,
            );
            if (!recargado.obtenerEstudiante().esMenorDeEdad(ahora)) {
              throw new ConflictException(
                MENSAJES_ATENCION.noRequiereConsentimiento,
              );
            }
            recargado.confirmarConsentimiento();
            await repos.casos.guardar(recargado);
          },
          { bloqueos: [`caso:${idCaso}`] },
        ),
    );
    return { consentimientoConfirmado: true };
  }

  /**
   * POST /atencion/casos/:idCaso/seguimiento {fechaHora, modalidad} → 201
   * (sd_CUD06, 6.a). El caso queda EN_SEGUIMIENTO; correo al estudiante.
   */
  @Post('casos/:idCaso/seguimiento')
  @HttpCode(201)
  async programarSeguimiento(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
    @Body() cuerpo: unknown,
  ): Promise<{ cita: CitaDto; aviso?: string }> {
    const psicologo = this.#psicologo(usuario, 'programarSeguimiento');
    const ahora = this.reloj();
    const { fechaHora, modalidad } = this.#leerCita(cuerpo, ahora);
    this.#exigirId(idCaso);
    const { caso, cita, requiere } = await conPersistencia(
      this.#registro,
      MENSAJES_PERTINENCIA.errorExpediente,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = this.#asignadoA(
              await repos.casos.buscarPorId(idCaso),
              psicologo,
            );
            if (!recargado.psicologo?.estaDisponible(fechaHora)) {
              throw new ConflictException(MENSAJES_PERTINENCIA.cruceHorario);
            }
            const nueva = regla(() =>
              recargado.programarCita(fechaHora, modalidad),
            );
            await repos.casos.guardar(recargado);
            await repos.citas.guardar(nueva);
            // B9, trazabilidad: cuándo y quién agendó el seguimiento.
            await repos.eventos.registrar({
              tipo: TipoEventoCaso.CITA_PROGRAMADA,
              idCaso,
              idActor: psicologo.id,
              idCita: nueva.idCita,
            });
            return {
              caso: recargado,
              cita: nueva,
              requiere: recargado.requiereConsentimiento(ahora),
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
      cita: citaDto(cita),
      ...(requiere
        ? { aviso: MENSAJES_PERTINENCIA.requiereConsentimiento }
        : {}),
    };
  }

  /** POST /atencion/casos/:idCaso/cierre (sd_CUD06, 6.b). */
  @Post('casos/:idCaso/cierre')
  @HttpCode(200)
  async cerrarCaso(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
  ): Promise<{ mensaje: string }> {
    const psicologo = this.#psicologo(usuario, 'cerrarCaso');
    this.#exigirId(idCaso);
    await conPersistencia(
      this.#registro,
      MENSAJES_PERTINENCIA.errorExpediente,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = this.#asignadoA(
              await repos.casos.buscarPorId(idCaso),
              psicologo,
            );
            if (!regla(() => recargado.cerrar())) {
              throw new ConflictException(
                MENSAJES_ATENCION.observacionesVacias,
              );
            }
            await repos.casos.guardar(recargado);
            // B9, trazabilidad: fecha y autor del cierre.
            await repos.eventos.registrar({
              tipo: TipoEventoCaso.CASO_CERRADO,
              idCaso,
              idActor: psicologo.id,
            });
          },
          { bloqueos: [`caso:${idCaso}`] },
        ),
    );
    return { mensaje: MENSAJES_ATENCION.casoCerrado };
  }

  #leerCita(
    cuerpo: unknown,
    ahora: Date,
  ): { fechaHora: Date; modalidad: Modalidad } {
    const campos = leerCuerpo(cuerpo, ['fechaHora', 'modalidad']);
    const fechaHora = leerFechaHoraFutura(campos, 'fechaHora', ahora);
    const modalidad = leerEnumerado(campos, 'modalidad', MODALIDADES);
    if (modalidad === null) {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }
    return { fechaHora, modalidad };
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

  /** La cita pertenece al caso (la cita no conoce su caso). */
  #citaDe(caso: CasoRiesgo, idCita: string): Cita {
    const cita = caso.citas.find((valor) => valor.idCita === idCita);
    if (cita === undefined) {
      throw new ForbiddenException();
    }
    return cita;
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
