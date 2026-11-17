import type { DataSource } from 'typeorm';
import { Alerta } from '../dominio/entidades/alerta';
import type { CasoRiesgo } from '../dominio/entidades/caso-riesgo';
import { EstadoCaso } from '../dominio/entidades/estado-caso';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import type { Persona } from '../dominio/entidades/persona';
import type { PlanNivelacion } from '../dominio/entidades/plan-nivelacion';
import type { RegistroAcademico } from '../dominio/entidades/registro-academico';
import type { Rol } from '../dominio/entidades/rol';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import { SolicitudAcompanamiento } from '../dominio/entidades/solicitud-acompanamiento';
import type { RepositorioAlerta } from '../dominio/repositorios/repositorio-alerta';
import type { RepositorioCasoRiesgo } from '../dominio/repositorios/repositorio-caso-riesgo';
import type { RepositorioPersona } from '../dominio/repositorios/repositorio-persona';
import type { RepositorioPlanNivelacion } from '../dominio/repositorios/repositorio-plan-nivelacion';
import type { RepositorioRegistroAcademico } from '../dominio/repositorios/repositorio-registro-academico';
import type { RepositorioSolicitud } from '../dominio/repositorios/repositorio-solicitud';
import {
  EsquemaCasoRiesgo,
  EsquemaPlanNivelacion,
  EsquemaRegistroAcademico,
  ModeloAlerta,
  ModeloPersona,
  ModeloSolicitud,
  TIPO_ALERTA,
  TIPO_SOLICITUD,
} from './esquemas';
import {
  escribirAlerta,
  escribirCaso,
  escribirPersona,
  escribirPlan,
  escribirRegistro,
  escribirSolicitud,
} from './mapeadores/escritores';
import { RepositorioPersistente } from './repositorio-persistente';

/*
 * Las 6 subclases de RepositorioPersistente<T>, una por contrato
 * especializado (nota del diagrama de clases v3). Cada una documenta qué
 * escribe guardar() en cascada. Las consultas usan parámetros ($1, $2...),
 * nunca concatenación de texto.
 *
 * El periodo es siempre el del curso (decisión D12): las alertas y los casos
 * de alerta lo toman del curso de su registro; los planes, de los cursos que
 * refuerzan; las solicitudes voluntarias no tienen curso.
 */

/**
 * guardar(persona): escribe la fila de la persona según su subclase.
 * Cascada: si es Docente, sus cursos (con id_docente). No escribe el
 * Programa, ni la agenda del Psicólogo (las citas se escriben desde el caso).
 */
export class RepositorioPersistentePersona
  extends RepositorioPersistente<Persona>
  implements RepositorioPersona
{
  constructor(fuente: DataSource) {
    super(fuente, {
      objetivo: ModeloPersona,
      propiedadId: 'id',
      criterios: { nombre: 'nombre', correo: 'correo' },
      cargar: (cargador, ids) => cargador.personas(ids),
      escribir: escribirPersona,
    });
  }

  async buscarPorCorreo(correo: string): Promise<Persona | null> {
    const [persona] = await this.cargarConsulta(
      'SELECT id FROM persona WHERE correo = $1',
      [correo],
    );
    return persona ?? null;
  }

  listarPorRol(rol: Rol): Promise<Persona[]> {
    return this.cargarConsulta(
      'SELECT id FROM persona WHERE rol = $1 ORDER BY nombre, id',
      [rol],
    );
  }

  async buscarJefePorPrograma(
    idPrograma: string,
  ): Promise<JefeDepartamento | null> {
    const [jefe] = await this.cargarConsulta(
      `SELECT id FROM persona
       WHERE rol = 'JEFE_DEPARTAMENTO' AND id_programa_dirigido = $1`,
      [idPrograma],
    );
    return jefe instanceof JefeDepartamento ? jefe : null;
  }
}

/**
 * guardar(caso): escribe el caso (con id_jefe derivado) y en cascada sus
 * citas (las nuevas con id_caso e id_psicologo) y las asesorías de esas
 * citas. No escribe el estudiante, el origen ni el psicólogo. Rechaza un
 * caso cuyo estudiante no coincida con el de su origen.
 */
export class RepositorioPersistenteCasoRiesgo
  extends RepositorioPersistente<CasoRiesgo>
  implements RepositorioCasoRiesgo
{
  constructor(fuente: DataSource) {
    super(fuente, {
      objetivo: EsquemaCasoRiesgo,
      propiedadId: 'idCaso',
      criterios: {
        estado: 'estado',
        ruta: 'ruta',
        nivelRiesgo: 'nivelRiesgo',
        confidencialidad: 'confidencialidad',
      },
      cargar: (cargador, ids) => cargador.casos(ids),
      escribir: escribirCaso,
    });
  }

  /** Bandeja del Jefe: PENDIENTE, sin ruta, estudiante del programa (7a). */
  listarPendientesPorPrograma(idPrograma: string): Promise<CasoRiesgo[]> {
    return this.cargarConsulta(
      `SELECT c.id_caso AS id
       FROM caso_riesgo c
       JOIN persona e ON e.id = c.id_estudiante
       WHERE c.estado = $1 AND c.ruta IS NULL AND e.id_programa = $2
       ORDER BY c.fecha_creacion, c.id_caso`,
      [EstadoCaso.PENDIENTE, idPrograma],
    );
  }

  /** Ruta PSICOLOGICA y estado PENDIENTE (7b). */
  listarPendientesRutaPsicologica(): Promise<CasoRiesgo[]> {
    return this.cargarConsulta(
      `SELECT id_caso AS id FROM caso_riesgo
       WHERE ruta = $1 AND estado = $2
       ORDER BY fecha_creacion, id_caso`,
      [RutaAtencion.PSICOLOGICA, EstadoCaso.PENDIENTE],
    );
  }

  listarPorPsicologo(idPsicologo: string): Promise<CasoRiesgo[]> {
    return this.cargarConsulta(
      `SELECT id_caso AS id FROM caso_riesgo
       WHERE id_psicologo = $1
       ORDER BY fecha_creacion, id_caso`,
      [idPsicologo],
    );
  }

  /**
   * Casos cerrados o archivados (sd_CUD10) de alertas sobre cursos del
   * periodo, de estudiantes del programa. Las solicitudes no aparecen (D12).
   */
  listarPorPeriodo(periodo: string, idPrograma: string): Promise<CasoRiesgo[]> {
    return this.cargarConsulta(
      `SELECT c.id_caso AS id
       FROM caso_riesgo c
       JOIN origen_riesgo o ON o.id_origen = c.id_origen AND o.tipo = $1
       JOIN registro_academico r ON r.id_registro = o.id_registro
       JOIN curso cu ON cu.id_curso = r.id_curso
       JOIN persona e ON e.id = c.id_estudiante
       WHERE cu.periodo = $2 AND e.id_programa = $3
         AND c.estado IN ($4, $5)
       ORDER BY c.fecha_creacion, c.id_caso`,
      [
        TIPO_ALERTA,
        periodo,
        idPrograma,
        EstadoCaso.CERRADO,
        EstadoCaso.ARCHIVADO,
      ],
    );
  }
}

/**
 * guardar(alerta): escribe solo la alerta. No escribe su caso (se guarda con
 * RepositorioCasoRiesgo), ni su docente ni su registro.
 */
export class RepositorioPersistenteAlerta
  extends RepositorioPersistente<Alerta>
  implements RepositorioAlerta
{
  constructor(fuente: DataSource) {
    super(fuente, {
      objetivo: ModeloAlerta,
      propiedadId: 'idOrigen',
      criterios: { estado: 'estado', nivelRiesgo: 'nivelRiesgo' },
      cargar: async (cargador, ids) =>
        (await cargador.origenes(ids)).filter(
          (origen): origen is Alerta => origen instanceof Alerta,
        ),
      escribir: escribirAlerta,
    });
  }

  listarPorDocente(idDocente: string, periodo: string): Promise<Alerta[]> {
    return this.cargarConsulta(
      `SELECT o.id_origen AS id
       FROM origen_riesgo o
       JOIN registro_academico r ON r.id_registro = o.id_registro
       JOIN curso cu ON cu.id_curso = r.id_curso
       WHERE o.tipo = $1 AND o.id_docente = $2 AND cu.periodo = $3
       ORDER BY o.fecha, o.id_origen`,
      [TIPO_ALERTA, idDocente, periodo],
    );
  }

  listarPorEstudiante(
    idEstudiante: string,
    periodo: string,
  ): Promise<Alerta[]> {
    return this.cargarConsulta(
      `SELECT o.id_origen AS id
       FROM origen_riesgo o
       JOIN registro_academico r ON r.id_registro = o.id_registro
       JOIN curso cu ON cu.id_curso = r.id_curso
       WHERE o.tipo = $1 AND r.id_estudiante = $2 AND cu.periodo = $3
       ORDER BY o.fecha, o.id_origen`,
      [TIPO_ALERTA, idEstudiante, periodo],
    );
  }

  listarPorCurso(
    idCurso: string,
    periodo: string,
    idPrograma: string,
  ): Promise<Alerta[]> {
    return this.cargarConsulta(
      `SELECT o.id_origen AS id
       FROM origen_riesgo o
       JOIN registro_academico r ON r.id_registro = o.id_registro
       JOIN curso cu ON cu.id_curso = r.id_curso
       JOIN persona e ON e.id = r.id_estudiante
       WHERE o.tipo = $1 AND r.id_curso = $2 AND cu.periodo = $3
         AND e.id_programa = $4
       ORDER BY o.fecha, o.id_origen`,
      [TIPO_ALERTA, idCurso, periodo, idPrograma],
    );
  }
}

/**
 * guardar(solicitud): escribe solo la solicitud. No escribe su caso ni su
 * estudiante.
 */
export class RepositorioPersistenteSolicitud
  extends RepositorioPersistente<SolicitudAcompanamiento>
  implements RepositorioSolicitud
{
  constructor(fuente: DataSource) {
    super(fuente, {
      objetivo: ModeloSolicitud,
      propiedadId: 'idOrigen',
      criterios: { estado: 'estado', tipoApoyo: 'tipoApoyo' },
      cargar: async (cargador, ids) =>
        (await cargador.origenes(ids)).filter(
          (origen): origen is SolicitudAcompanamiento =>
            origen instanceof SolicitudAcompanamiento,
        ),
      escribir: escribirSolicitud,
    });
  }

  listarPorEstudiante(
    idEstudiante: string,
  ): Promise<SolicitudAcompanamiento[]> {
    return this.cargarConsulta(
      `SELECT id_origen AS id FROM origen_riesgo
       WHERE tipo = $1 AND id_estudiante = $2
       ORDER BY fecha, id_origen`,
      [TIPO_SOLICITUD, idEstudiante],
    );
  }
}

/**
 * guardar(registro): escribe solo el registro. No escribe el estudiante ni
 * el curso. (En B4 la sincronización usará este repositorio.)
 */
export class RepositorioPersistenteRegistroAcademico
  extends RepositorioPersistente<RegistroAcademico>
  implements RepositorioRegistroAcademico
{
  constructor(fuente: DataSource) {
    super(fuente, {
      objetivo: EsquemaRegistroAcademico,
      propiedadId: 'idRegistro',
      criterios: {},
      cargar: (cargador, ids) => cargador.registros(ids),
      escribir: escribirRegistro,
    });
  }

  listarPorCurso(idCurso: string): Promise<RegistroAcademico[]> {
    return this.cargarConsulta(
      `SELECT id_registro AS id FROM registro_academico
       WHERE id_curso = $1 ORDER BY id_registro`,
      [idCurso],
    );
  }

  listarPorEstudiante(
    idEstudiante: string,
    periodo: string,
  ): Promise<RegistroAcademico[]> {
    return this.cargarConsulta(
      `SELECT r.id_registro AS id
       FROM registro_academico r
       JOIN curso cu ON cu.id_curso = r.id_curso
       WHERE r.id_estudiante = $1 AND cu.periodo = $2
       ORDER BY r.id_registro`,
      [idEstudiante, periodo],
    );
  }
}

/**
 * guardar(plan): escribe el plan (con id_jefe derivado) y en cascada su
 * asociación "refuerza" con los cursos. No escribe el caso ni los cursos.
 */
export class RepositorioPersistentePlanNivelacion
  extends RepositorioPersistente<PlanNivelacion>
  implements RepositorioPlanNivelacion
{
  constructor(fuente: DataSource) {
    super(fuente, {
      objetivo: EsquemaPlanNivelacion,
      propiedadId: 'idPlan',
      criterios: { estado: 'estado' },
      cargar: (cargador, ids) => cargador.planes(ids),
      escribir: escribirPlan,
    });
  }

  /** Planes que refuerzan algún curso del periodo, de estudiantes del programa (D12). */
  listarPorPeriodo(
    periodo: string,
    idPrograma: string,
  ): Promise<PlanNivelacion[]> {
    return this.cargarConsulta(
      `SELECT p.id_plan AS id
       FROM plan_nivelacion p
       JOIN caso_riesgo c ON c.id_caso = p.id_caso
       JOIN persona e ON e.id = c.id_estudiante
       WHERE e.id_programa = $2
         AND EXISTS (
           SELECT 1 FROM plan_nivelacion_curso pc
           JOIN curso cu ON cu.id_curso = pc.id_curso
           WHERE pc.id_plan = p.id_plan AND cu.periodo = $1
         )
       ORDER BY p.fecha, p.id_plan`,
      [periodo, idPrograma],
    );
  }
}
