import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  Query,
} from '@nestjs/common';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import { Estudiante } from '../dominio/entidades/estudiante';
import type { Persona } from '../dominio/entidades/persona';
import type { RepositorioAlerta } from '../dominio/repositorios/repositorio-alerta';
import type { RepositorioCasoRiesgo } from '../dominio/repositorios/repositorio-caso-riesgo';
import type { RepositorioRegistroAcademico } from '../dominio/repositorios/repositorio-registro-academico';
import type { RepositorioSolicitud } from '../dominio/repositorios/repositorio-solicitud';
import {
  REPOSITORIO_ALERTA,
  REPOSITORIO_CASO_RIESGO,
  REPOSITORIO_REGISTRO_ACADEMICO,
  REPOSITORIO_SOLICITUD,
} from '../dominio/repositorios/tokens';
import { ControladorBase } from './controlador-base';
import {
  alertaEstudiante,
  conPersistencia,
  MENSAJE_ERROR_CONSULTA,
  MENSAJE_INFORMACION_NO_DISPONIBLE,
  registroEstudiante,
  solicitud,
  type AlertaEstudianteDto,
  type RegistrosEstudianteDto,
  type SolicitudDto,
} from './respuestas';
import { UsuarioSesion } from './sesion';
import { leerPeriodo } from './validacion-entrada';

/**
 * Controlador `ControladorConsultaEstudiante` (diagrama de clases v3; rama
 * Estudiante de sd_CUD01). Solo lectura; el estudiante ve únicamente lo suyo
 * (ER 3.5.3): el identificador siempre sale de la sesión, nunca de la URL.
 */
@Controller('consulta')
export class ControladorConsultaEstudiante extends ControladorBase {
  readonly #registro = new Logger('ControladorConsultaEstudiante');

  constructor(
    controlAcceso: ControlAcceso,
    @Inject(REPOSITORIO_REGISTRO_ACADEMICO)
    private readonly registros: RepositorioRegistroAcademico,
    @Inject(REPOSITORIO_ALERTA)
    private readonly alertas: RepositorioAlerta,
    @Inject(REPOSITORIO_SOLICITUD)
    private readonly solicitudes: RepositorioSolicitud,
    @Inject(REPOSITORIO_CASO_RIESGO)
    private readonly casos: RepositorioCasoRiesgo,
  ) {
    super(controlAcceso);
  }

  /** GET /consulta/registros?periodo= */
  @Get('registros')
  async consultarRegistros(
    @UsuarioSesion() usuario: Persona,
    @Query('periodo') periodo: unknown,
  ): Promise<RegistrosEstudianteDto> {
    const estudiante = this.#estudiante(usuario, 'consultarRegistros');
    const valorPeriodo = leerPeriodo(periodo);
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () => {
      const registros = await this.registros.listarPorEstudiante(
        estudiante.id,
        valorPeriodo,
      );
      return {
        registros: registros.map(registroEstudiante),
        ...(registros.length === 0
          ? { mensaje: MENSAJE_INFORMACION_NO_DISPONIBLE }
          : {}),
      };
    });
  }

  /** GET /consulta/alertas?periodo= (flujo 2.a). */
  @Get('alertas')
  async consultarAlertas(
    @UsuarioSesion() usuario: Persona,
    @Query('periodo') periodo: unknown,
  ): Promise<AlertaEstudianteDto[]> {
    const estudiante = this.#estudiante(usuario, 'consultarAlertas');
    const valorPeriodo = leerPeriodo(periodo);
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () =>
      (await this.alertas.listarPorEstudiante(estudiante.id, valorPeriodo)).map(
        alertaEstudiante,
      ),
    );
  }

  /** GET /consulta/solicitudes (flujo 2.b), con el estado derivado del caso. */
  @Get('solicitudes')
  async consultarSolicitudes(
    @UsuarioSesion() usuario: Persona,
  ): Promise<SolicitudDto[]> {
    const estudiante = this.#estudiante(usuario, 'consultarSolicitudes');
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () => {
      const propias = await this.solicitudes.listarPorEstudiante(estudiante.id);
      const estados = await this.casos.listarEstadosPorOrigen(
        propias.map((origen) => origen.idOrigen),
      );
      return propias.map((origen) =>
        solicitud(origen, estados.get(origen.idOrigen)),
      );
    });
  }

  #estudiante(usuario: Persona, accion: string): Estudiante {
    if (
      !this.verificarPermiso(usuario, accion) ||
      !(usuario instanceof Estudiante)
    ) {
      throw new ForbiddenException();
    }
    return usuario;
  }
}
