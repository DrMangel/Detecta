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
import {
  UNIDAD_TRABAJO,
  type UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import { ServicioNotificacion } from '../aplicacion/servicios/servicio-notificacion';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import type { Persona } from '../dominio/entidades/persona';
import { Rol } from '../dominio/entidades/rol';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import type { RepositorioCasoRiesgo } from '../dominio/repositorios/repositorio-caso-riesgo';
import type { RepositorioRegistroAcademico } from '../dominio/repositorios/repositorio-registro-academico';
import {
  REPOSITORIO_CASO_RIESGO,
  REPOSITORIO_REGISTRO_ACADEMICO,
} from '../dominio/repositorios/tokens';
import { ControladorBase } from './controlador-base';
import { conPersistencia, MENSAJE_ERROR_CONSULTA, regla } from './respuestas';
import {
  antecedentes,
  casoJefe,
  type CasoDto,
  type DetalleDto,
} from './respuestas-casos';
import { UsuarioSesion } from './sesion';
import {
  leerCuerpo,
  leerEnumerado,
  LONGITUD_MAXIMA,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

/** Mensajes de sd_CUD04 y los textos nuevos aprobados en el plan de B7. */
export const MENSAJES_CASOS = {
  yaCanalizado: 'El caso ya fue canalizado',
  remitidoPsicologia: 'Caso remitido a psicología',
  errorCanalizacion: 'Error al registrar la canalización',
  /** Textos nuevos (respuesta 12). */
  canalizadoAcademica: 'Caso canalizado a la ruta académica',
  sinJefe:
    'El programa del estudiante no tiene Jefe de Departamento configurado.',
} as const;

const RUTAS = Object.values(RutaAtencion);

/**
 * Controlador `ControladorCasosRiesgo` (diagrama de clases v3; R03, sd_CUD04).
 *
 * Visibilidad (D18; ajuste A del plan de B7): el Jefe solo ve casos de su
 * programa y NUNCA los de una solicitud psicosocial; la exclusión se hace en
 * la consulta (`listarPendientesPorPrograma` exige ruta nula y
 * `buscarParaPrograma` excluye esas solicitudes en SQL). El contenido de una
 * solicitud académica solo se muestra mientras no se canalice a psicología.
 */
@Controller('casos')
export class ControladorCasosRiesgo extends ControladorBase {
  readonly #registro = new Logger('ControladorCasosRiesgo');

  constructor(
    controlAcceso: ControlAcceso,
    @Inject(REPOSITORIO_CASO_RIESGO)
    private readonly casos: RepositorioCasoRiesgo,
    @Inject(REPOSITORIO_REGISTRO_ACADEMICO)
    private readonly registros: RepositorioRegistroAcademico,
    @Inject(UNIDAD_TRABAJO)
    private readonly unidadTrabajo: UnidadTrabajo,
    private readonly notificacion: ServicioNotificacion,
  ) {
    super(controlAcceso);
  }

  /** GET /casos/pendientes: bandeja del programa que dirige (sd_CUD04). */
  @Get('pendientes')
  async listarCasosPendientes(
    @UsuarioSesion() usuario: Persona,
  ): Promise<CasoDto[]> {
    const jefe = this.#jefe(usuario, 'listarCasosPendiente');
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () =>
      (
        await this.casos.listarPendientesPorPrograma(jefe.programa.idPrograma)
      ).map((caso) => casoJefe(this.controlAcceso, jefe, caso)),
    );
  }

  /**
   * GET /casos/:idCaso (fuera del diagrama, respuesta 5): el caso con la
   * visibilidad aplicada y los antecedentes académicos del estudiante.
   */
  @Get(':idCaso')
  async consultarCaso(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
  ): Promise<DetalleDto<CasoDto>> {
    const jefe = this.#jefe(usuario, 'listarCasosPendiente');
    return conPersistencia(this.#registro, MENSAJE_ERROR_CONSULTA, async () => {
      const caso =
        idCaso.length > LONGITUD_MAXIMA.identificador
          ? null
          : await this.casos.buscarParaPrograma(
              idCaso,
              jefe.programa.idPrograma,
            );
      if (caso === null) {
        throw new ForbiddenException();
      }
      const registros = await this.registros.listar(
        new Map([['idEstudiante', caso.obtenerEstudiante().id]]),
      );
      return {
        caso: casoJefe(this.controlAcceso, jefe, caso),
        antecedentes: antecedentes(registros),
      };
    });
  }

  /**
   * POST /casos/:idCaso/canalizacion {ruta} (sd_CUD04). Bloqueo con espera
   * por caso y recarga dentro de la transacción: dos sesiones que canalizan a
   * la vez reciben "El caso ya fue canalizado" (R03, 5.a).
   */
  @Post(':idCaso/canalizacion')
  @HttpCode(200)
  async canalizarCaso(
    @UsuarioSesion() usuario: Persona,
    @Param('idCaso') idCaso: string,
    @Body() cuerpo: unknown,
  ): Promise<{ mensaje: string; caso: CasoDto }> {
    const jefe = this.#jefe(usuario, 'canalizarCaso');
    const ruta = leerEnumerado(leerCuerpo(cuerpo, ['ruta']), 'ruta', RUTAS);
    if (ruta === null) {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }
    if (idCaso.length > LONGITUD_MAXIMA.identificador) {
      throw new ForbiddenException();
    }
    const { caso, psicologos } = await conPersistencia(
      this.#registro,
      MENSAJES_CASOS.errorCanalizacion,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = await repos.casos.buscarParaPrograma(
              idCaso,
              jefe.programa.idPrograma,
            );
            if (recargado === null) {
              throw new ForbiddenException();
            }
            if (recargado.estaCanalizado()) {
              throw new ConflictException(MENSAJES_CASOS.yaCanalizado);
            }
            // Requisito heredado de B6: canalizar exige jefe en el programa.
            const jefePrograma = await repos.personas.buscarJefePorPrograma(
              recargado.obtenerEstudiante().obtenerPrograma().idPrograma,
            );
            if (jefePrograma === null) {
              throw new ConflictException(MENSAJES_CASOS.sinJefe);
            }
            regla(() => recargado.canalizar(ruta));
            await repos.casos.guardar(recargado);
            return {
              caso: recargado,
              psicologos:
                ruta === RutaAtencion.PSICOLOGICA
                  ? await repos.personas.listarPorRol(Rol.PSICOLOGO)
                  : [],
            };
          },
          { bloqueos: [`caso:${idCaso}`] },
        ),
    );

    // Después del commit y sin esperar. La ruta académica no notifica: el
    // Jefe estructura el plan (B8); al estudiante no se le notifica la
    // canalización (D8).
    if (ruta === RutaAtencion.PSICOLOGICA && psicologos.length > 0) {
      void this.notificacion.notificarCasoRemitido(caso, psicologos);
    }
    return {
      mensaje:
        ruta === RutaAtencion.PSICOLOGICA
          ? MENSAJES_CASOS.remitidoPsicologia
          : MENSAJES_CASOS.canalizadoAcademica,
      caso: casoJefe(this.controlAcceso, jefe, caso),
    };
  }

  #jefe(usuario: Persona, accion: string): JefeDepartamento {
    if (
      !this.verificarPermiso(usuario, accion) ||
      !(usuario instanceof JefeDepartamento)
    ) {
      throw new ForbiddenException();
    }
    return usuario;
  }
}
