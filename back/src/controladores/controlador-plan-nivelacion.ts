import { TipoEventoCaso } from '../aplicacion/contratos/registro-eventos-caso';
import {
  BadRequestException,
  Body,
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
import { ServicioNotificacion } from '../aplicacion/servicios/servicio-notificacion';
import type { Curso } from '../dominio/entidades/curso';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import type { Persona } from '../dominio/entidades/persona';
import { ControladorBase } from './controlador-base';
import { conPersistencia, regla } from './respuestas';
import { planDto, type PlanDto } from './respuestas-casos';
import { UsuarioSesion } from './sesion';
import {
  leerCuerpo,
  leerListaIdentificadores,
  leerTexto,
  LONGITUD_MAXIMA,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

/** Mensajes de sd_CUD04 (extensión CUD05) y textos del plan de B8. */
export const MENSAJES_PLAN = {
  faltaTutor: 'Faltan los datos del estudiante tutor',
  registrado: 'Plan de nivelación registrado',
  /** Textos nuevos (respuestas 10 y 12 del plan de B8). */
  errorRegistro: 'Error al registrar el plan de nivelación',
  bloqueoPlan: 'Otra sesión está modificando este plan. Intente de nuevo.',
} as const;

/**
 * Controlador `ControladorPlanNivelacion` (diagrama de clases v3; R04;
 * extensión CUD05 de sd_CUD04). El caso queda EN_NIVELACION al registrar y
 * al finalizar el plan (respuesta 3); se admiten varios planes por caso.
 * `descripcion` queda vacía (D10).
 */
@Controller('planes')
export class ControladorPlanNivelacion extends ControladorBase {
  readonly #registro = new Logger('ControladorPlanNivelacion');

  constructor(
    controlAcceso: ControlAcceso,
    @Inject(UNIDAD_TRABAJO)
    private readonly unidadTrabajo: UnidadTrabajo,
    private readonly notificacion: ServicioNotificacion,
  ) {
    super(controlAcceso);
  }

  /**
   * POST /planes {idCaso, idsCursos, tutorNombre, tutorCodigo, cronograma?}
   * → 201. Solo cursos en los que el estudiante tiene registro académico
   * (respuesta 6). Bloqueo con espera del caso; correo al estudiante después
   * del commit, sin esperarlo.
   */
  @Post()
  @HttpCode(201)
  async estructurarPlan(
    @UsuarioSesion() usuario: Persona,
    @Body() cuerpo: unknown,
  ): Promise<{ mensaje: string; plan: PlanDto }> {
    const jefe = this.#jefe(usuario, 'estructurarPlan');
    const campos = leerCuerpo(cuerpo, [
      'idCaso',
      'idsCursos',
      'tutorNombre',
      'tutorCodigo',
      'cronograma',
    ]);
    const idCaso = leerTexto(campos, 'idCaso', LONGITUD_MAXIMA.descripcion);
    const idsCursos = leerListaIdentificadores(campos, 'idsCursos');
    const tutorNombre = leerTexto(
      campos,
      'tutorNombre',
      LONGITUD_MAXIMA.tutorNombre,
    );
    const tutorCodigo = leerTexto(
      campos,
      'tutorCodigo',
      LONGITUD_MAXIMA.tutorCodigo,
    );
    const cronograma = leerTexto(
      campos,
      'cronograma',
      LONGITUD_MAXIMA.cronograma,
    );
    if (idCaso === '') {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }
    // CUD05 5.a: el sistema indica los datos faltantes y no almacena el plan.
    if (tutorNombre === '' || tutorCodigo === '') {
      throw new BadRequestException(MENSAJES_PLAN.faltaTutor);
    }
    if (idCaso.length > LONGITUD_MAXIMA.identificador) {
      throw new ForbiddenException();
    }

    const plan = await conPersistencia(
      this.#registro,
      MENSAJES_PLAN.errorRegistro,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const caso = await repos.casos.buscarParaPrograma(
              idCaso,
              jefe.programa.idPrograma,
            );
            if (caso === null) {
              throw new ForbiddenException();
            }
            const estudiante = caso.obtenerEstudiante();
            const matriculados = new Set(
              (
                await repos.registros.listar(
                  new Map([['idEstudiante', estudiante.id]]),
                )
              ).map((registro) => registro.curso.idCurso),
            );
            if (idsCursos.some((id) => !matriculados.has(id))) {
              throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
            }
            const cursos: Curso[] = [];
            for (const id of idsCursos) {
              const curso = await repos.cursos.buscarPorId(id);
              if (curso === null) {
                throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
              }
              cursos.push(curso);
            }
            const nuevo = regla(() =>
              jefe.estructurarPlanNivelacion(
                caso,
                cursos,
                tutorNombre,
                tutorCodigo,
                cronograma,
              ),
            );
            await repos.planes.guardar(nuevo);
            return nuevo;
          },
          { bloqueos: [`caso:${idCaso}`] },
        ),
    );

    void this.notificacion.notificarPlanNivelacion(plan);
    return { mensaje: MENSAJES_PLAN.registrado, plan: planDto(plan) };
  }

  /**
   * POST /planes/:idPlan/finalizacion (extensión 1.a de CUD05; nota de
   * sd_CUD04): `plan.finalizar()`. El caso sigue EN_NIVELACION.
   */
  @Post(':idPlan/finalizacion')
  @HttpCode(200)
  async finalizarPlan(
    @UsuarioSesion() usuario: Persona,
    @Param('idPlan') idPlan: string,
  ): Promise<{ plan: PlanDto }> {
    const jefe = this.#jefe(usuario, 'finalizarPlan');
    if (idPlan.length > LONGITUD_MAXIMA.identificador) {
      throw new ForbiddenException();
    }
    const plan = await conPersistencia(
      this.#registro,
      MENSAJES_PLAN.errorRegistro,
      () =>
        this.unidadTrabajo.ejecutar(
          async (repos) => {
            const recargado = await repos.planes.buscarPorId(idPlan);
            if (
              recargado === null ||
              recargado.obtenerEstudiante().obtenerPrograma().idPrograma !==
                jefe.programa.idPrograma
            ) {
              throw new ForbiddenException();
            }
            regla(() => recargado.finalizar());
            await repos.planes.guardar(recargado);
            // B9, trazabilidad: fecha y autor de la finalización del plan.
            await repos.eventos.registrar({
              tipo: TipoEventoCaso.PLAN_FINALIZADO,
              idCaso: recargado.caso.idCaso,
              idActor: jefe.id,
              idPlan,
            });
            return recargado;
          },
          { bloqueos: [`plan:${idPlan}`] },
        ),
      MENSAJES_PLAN.bloqueoPlan,
    );
    return { plan: planDto(plan) };
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
