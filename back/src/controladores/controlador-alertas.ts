import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  UNIDAD_TRABAJO,
  type UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import { ServicioNotificacion } from '../aplicacion/servicios/servicio-notificacion';
import type { Curso } from '../dominio/entidades/curso';
import { Docente } from '../dominio/entidades/docente';
import { NivelRiesgo } from '../dominio/entidades/nivel-riesgo';
import type { Persona } from '../dominio/entidades/persona';
import type { Repositorio } from '../dominio/repositorios/repositorio';
import type { RepositorioAlerta } from '../dominio/repositorios/repositorio-alerta';
import type { RepositorioCasoRiesgo } from '../dominio/repositorios/repositorio-caso-riesgo';
import type { RepositorioRegistroAcademico } from '../dominio/repositorios/repositorio-registro-academico';
import {
  REPOSITORIO_ALERTA,
  REPOSITORIO_CASO_RIESGO,
  REPOSITORIO_CURSO,
  REPOSITORIO_REGISTRO_ACADEMICO,
} from '../dominio/repositorios/tokens';
import { ControladorBase } from './controlador-base';
import {
  alertaEmitida,
  conPersistencia,
  fechaIso,
  MENSAJE_ERROR_CONSULTA,
  MENSAJE_INFORMACION_NO_DISPONIBLE,
  registroCurso,
  type AlertaEmitidaDto,
  type ConsultaCursoDto,
} from './respuestas';
import { UsuarioSesion } from './sesion';
import {
  leerCuerpo,
  leerEnumerado,
  leerPeriodo,
  leerTexto,
  LONGITUD_MAXIMA,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

/** Mensajes de sd_CUD03 y sd_CUD01 (rama Docente). */
export const MENSAJES_ALERTAS = {
  camposVacios: 'Complete el nivel de riesgo y la justificación',
  registroAjeno: 'El estudiante no pertenece a un curso asignado',
  cursoAjeno: 'El curso no está asignado al docente',
  emitida: 'Alerta emitida y remitida al Jefe de Departamento',
  errorRegistro: 'Error al registrar la alerta',
} as const;

const NIVELES = Object.values(NivelRiesgo);

/**
 * Controlador `ControladorAlertas` (diagrama de clases v3; R01, CUD03 y la
 * rama Docente de CUD01). Orquesta como las secuencias: no hay servicio de
 * aplicación intermedio en el diagrama.
 */
@Controller('alertas')
export class ControladorAlertas extends ControladorBase {
  readonly #registro = new Logger('ControladorAlertas');

  constructor(
    controlAcceso: ControlAcceso,
    @Inject(REPOSITORIO_CURSO)
    private readonly cursos: Repositorio<Curso>,
    @Inject(REPOSITORIO_REGISTRO_ACADEMICO)
    private readonly registros: RepositorioRegistroAcademico,
    @Inject(REPOSITORIO_ALERTA)
    private readonly alertas: RepositorioAlerta,
    @Inject(REPOSITORIO_CASO_RIESGO)
    private readonly casos: RepositorioCasoRiesgo,
    @Inject(UNIDAD_TRABAJO)
    private readonly unidadTrabajo: UnidadTrabajo,
    private readonly notificacion: ServicioNotificacion,
  ) {
    super(controlAcceso);
  }

  /**
   * GET /alertas/cursos/:idCurso (sd_CUD01, rama Docente). Un curso
   * inexistente responde igual que uno ajeno (respuesta 9: no revela qué
   * existe).
   */
  @Get('cursos/:idCurso')
  async consultarCurso(
    @UsuarioSesion() usuario: Persona,
    @Param('idCurso') idCurso: string,
  ): Promise<ConsultaCursoDto> {
    const docente = this.#docente(usuario, 'consultarCurso');
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () => {
      const curso =
        idCurso.length > LONGITUD_MAXIMA.identificador
          ? null
          : await this.cursos.buscarPorId(idCurso);
      if (curso === null || !docente.dicta(curso)) {
        throw new ForbiddenException(MENSAJES_ALERTAS.cursoAjeno);
      }
      const registros = await this.registros.listarPorCurso(curso.idCurso);
      return {
        curso: {
          idCurso: curso.idCurso,
          nombre: curso.nombre,
          periodo: curso.periodo,
          ultimaSincronizacion: fechaIso(curso.ultimaSincronizacion),
        },
        registros: registros.map(registroCurso),
        ...(registros.length === 0
          ? { mensaje: MENSAJE_INFORMACION_NO_DISPONIBLE }
          : {}),
      };
    });
  }

  /** GET /alertas/emitidas?periodo= (sd_CUD01, flujo 2.c). */
  @Get('emitidas')
  async consultarAlertasEmitidas(
    @UsuarioSesion() usuario: Persona,
    @Query('periodo') periodo: unknown,
  ): Promise<AlertaEmitidaDto[]> {
    const docente = this.#docente(usuario, 'consultarAlertasEmitidas');
    const valorPeriodo = leerPeriodo(periodo);
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () => {
      const alertas = await this.alertas.listarPorDocente(
        docente.id,
        valorPeriodo,
      );
      const estados = await this.casos.listarEstadosPorOrigen(
        alertas.map((alerta) => alerta.idOrigen),
      );
      return alertas.map((alerta) =>
        alertaEmitida(alerta, estados.get(alerta.idOrigen)),
      );
    });
  }

  /**
   * POST /alertas {idRegistro, nivelRiesgo, descripcion} → 201 (sd_CUD03).
   * La alerta y su caso se guardan en una transacción (primero el origen,
   * D7); los correos se lanzan después del commit y no se esperan.
   */
  @Post()
  @HttpCode(201)
  async emitirAlerta(
    @UsuarioSesion() usuario: Persona,
    @Body() cuerpo: unknown,
  ): Promise<{ mensaje: string; alerta: AlertaEmitidaDto }> {
    const docente = this.#docente(usuario, 'emitirAlerta');
    const campos = leerCuerpo(cuerpo, [
      'idRegistro',
      'nivelRiesgo',
      'descripcion',
    ]);
    // Un id más largo que la columna no puede existir: se responde como
    // inexistente (403, respuesta 9), no como texto largo.
    const idRegistro = leerTexto(
      campos,
      'idRegistro',
      LONGITUD_MAXIMA.descripcion,
    );
    const nivelRiesgo = leerEnumerado(campos, 'nivelRiesgo', NIVELES);
    const descripcion = leerTexto(
      campos,
      'descripcion',
      LONGITUD_MAXIMA.descripcion,
    );
    if (nivelRiesgo === null || descripcion === '') {
      throw new BadRequestException(MENSAJES_ALERTAS.camposVacios);
    }
    if (idRegistro === '') {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }

    const { alerta, caso, jefe } = await conPersistencia(
      this.#registro,
      MENSAJES_ALERTAS.errorRegistro,
      () =>
        this.unidadTrabajo.ejecutar(async (repos) => {
          const registro =
            idRegistro.length > LONGITUD_MAXIMA.identificador
              ? null
              : await repos.registros.buscarPorId(idRegistro);
          if (registro === null || !docente.dicta(registro.curso)) {
            throw new ForbiddenException(MENSAJES_ALERTAS.registroAjeno);
          }
          const nueva = docente.emitirAlerta(
            registro,
            nivelRiesgo,
            descripcion,
          );
          const casoNuevo = nueva.generarCasoRiesgo();
          await repos.alertas.guardar(nueva);
          await repos.casos.guardar(casoNuevo);
          const jefePrograma = await repos.personas.buscarJefePorPrograma(
            casoNuevo.obtenerEstudiante().obtenerPrograma().idPrograma,
          );
          return { alerta: nueva, caso: casoNuevo, jefe: jefePrograma };
        }),
    );

    // Después del commit; sin esperar el envío (respuesta 6).
    void this.notificacion.notificarAlertaEstudiante(alerta);
    if (jefe === null) {
      // Respuesta 8: el caso queda en la bandeja del programa; solo se
      // omite el correo. Aviso sin datos personales.
      this.#registro.warn(
        `Programa ${alerta.obtenerEstudiante().obtenerPrograma().idPrograma} sin jefe: no se envía la notificación del caso remitido`,
      );
    } else {
      void this.notificacion.notificarCasoRemitido(caso, [jefe]);
    }
    return {
      mensaje: MENSAJES_ALERTAS.emitida,
      alerta: alertaEmitida(alerta, caso.estado),
    };
  }

  /** verificarPermiso (ControladorBase) y el Docente de la sesión. */
  #docente(usuario: Persona, accion: string): Docente {
    if (
      !this.verificarPermiso(usuario, accion) ||
      !(usuario instanceof Docente)
    ) {
      throw new ForbiddenException();
    }
    return usuario;
  }
}
