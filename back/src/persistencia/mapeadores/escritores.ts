import { In, IsNull, type EntityManager } from 'typeorm';
import type { Alerta } from '../../dominio/entidades/alerta';
import type { Asesoria } from '../../dominio/entidades/asesoria';
import type { CasoRiesgo } from '../../dominio/entidades/caso-riesgo';
import type { Cita } from '../../dominio/entidades/cita';
import type { Curso } from '../../dominio/entidades/curso';
import { Docente } from '../../dominio/entidades/docente';
import { Estudiante } from '../../dominio/entidades/estudiante';
import type { InformeRiesgo } from '../../dominio/entidades/informe-riesgo';
import { JefeDepartamento } from '../../dominio/entidades/jefe-departamento';
import {
  leerContrasenaHash,
  type Persona,
} from '../../dominio/entidades/persona';
import type { PlanNivelacion } from '../../dominio/entidades/plan-nivelacion';
import type { Programa } from '../../dominio/entidades/programa';
import { Psicologo } from '../../dominio/entidades/psicologo';
import type { RegistroAcademico } from '../../dominio/entidades/registro-academico';
import { RutaAtencion } from '../../dominio/entidades/ruta-atencion';
import { SolicitudAcompanamiento } from '../../dominio/entidades/solicitud-acompanamiento';
import {
  EsquemaAsesoria,
  EsquemaCasoRiesgo,
  EsquemaCita,
  EsquemaCurso,
  EsquemaInformeRiesgo,
  EsquemaInformeRiesgoCaso,
  EsquemaInformeRiesgoPlan,
  EsquemaPlanNivelacion,
  EsquemaPlanNivelacionCurso,
  EsquemaPrograma,
  EsquemaRegistroAcademico,
  ModeloAlerta,
  ModeloDocente,
  ModeloEstudiante,
  ModeloJefeDepartamento,
  ModeloPersona,
  ModeloPsicologo,
  ModeloSolicitud,
  EsquemaTokenActivacion,
  type FilaAsesoria,
  type FilaCita,
} from '../esquemas';
import { verificarCoherenciaEstudianteOrigen } from './coherencia';
import { aTextoFecha } from './fechas';

/*
 * Escritores dominio → filas. Cada función documenta qué escribe en cascada.
 * Se ejecutan dentro de la transacción de `RepositorioPersistente.guardar`.
 * Ninguno borra filas: la aplicación no tiene permiso DELETE (ER 3.7 c).
 */

/** Escribe el programa. */
export async function escribirPrograma(
  m: EntityManager,
  programa: Programa,
): Promise<void> {
  await m.upsert(
    EsquemaPrograma,
    { idPrograma: programa.idPrograma, nombre: programa.nombre },
    ['idPrograma'],
  );
}

/**
 * Escribe la fila de la persona según su subclase (herencia de tabla única).
 * No escribe el Programa (debe existir).
 * - Docente: escribe en cascada sus cursos con `id_docente` (la asociación
 *   "dicta" solo es navegable desde el docente). No escribe los estudiantes
 *   ni los registros de esos cursos.
 * - Psicologo: NO escribe su agenda; las citas se insertan desde
 *   `guardar(caso)`.
 *
 * Regla del hash (aprobada por Ivan en el plan de B4): en una fila EXISTENTE
 * nunca se cambia `contrasena_hash`; solo lo cambia RepositorioCredenciales
 * (activación, D6). Así la sincronización y los datos iniciales no pueden
 * pisar la contraseña de una cuenta ya activada. Al insertar, se guarda el
 * hash de la entidad (el centinela de una cuenta sin activar).
 *
 * Si cambia el correo de una persona existente, se anulan sus tokens de
 * activación pendientes: se enviaron al correo anterior (plan de B4, 11).
 */
export async function escribirPersona(
  m: EntityManager,
  persona: Persona,
): Promise<void> {
  const { modelo, propias } = filaPropiaDePersona(persona);
  const comunes = { nombre: persona.nombre, correo: persona.correo };
  const existente = await m.findOne(ModeloPersona, {
    where: { id: persona.id },
  });
  if (existente === null) {
    await m.save(modelo, {
      id: persona.id,
      ...comunes,
      ...propias,
      contrasenaHash: leerContrasenaHash(persona),
    });
  } else {
    if (!(existente instanceof modelo)) {
      throw new Error(`La persona ${persona.id} ya existe con otro rol`);
    }
    if (existente.correo !== persona.correo) {
      await m.update(
        EsquemaTokenActivacion,
        { idPersona: persona.id, usadoEn: IsNull(), anuladoEn: IsNull() },
        { anuladoEn: new Date() },
      );
    }
    await m.update(modelo, { id: persona.id }, { ...comunes, ...propias });
  }
  if (persona instanceof Docente) {
    for (const curso of persona.cursos) {
      await m.upsert(
        EsquemaCurso,
        {
          idCurso: curso.idCurso,
          nombre: curso.nombre,
          periodo: curso.periodo,
          ultimaSincronizacion: curso.ultimaSincronizacion,
          idDocente: persona.id,
        },
        ['idCurso'],
      );
    }
  }
}

/** Modelo de la subclase y sus columnas propias (herencia de tabla única). */
function filaPropiaDePersona(persona: Persona): {
  modelo:
    | typeof ModeloEstudiante
    | typeof ModeloJefeDepartamento
    | typeof ModeloDocente
    | typeof ModeloPsicologo;
  propias: Record<string, unknown>;
} {
  if (persona instanceof Estudiante) {
    return {
      modelo: ModeloEstudiante,
      propias: {
        fechaNacimiento: aTextoFecha(persona.fechaNacimiento),
        idPrograma: persona.obtenerPrograma().idPrograma,
      },
    };
  }
  if (persona instanceof JefeDepartamento) {
    return {
      modelo: ModeloJefeDepartamento,
      propias: { idProgramaDirigido: persona.programa.idPrograma },
    };
  }
  if (persona instanceof Docente) {
    return { modelo: ModeloDocente, propias: {} };
  }
  if (persona instanceof Psicologo) {
    return { modelo: ModeloPsicologo, propias: {} };
  }
  throw new Error(
    `Subclase de Persona no soportada: ${persona.constructor.name}`,
  );
}

/**
 * Solo ACTUALIZA un curso existente (nombre, periodo, última sincronización).
 * Los cursos se crean en cascada desde `guardar(docente)`, porque el curso no
 * conoce a su docente y `id_docente` es obligatorio.
 */
export async function escribirCurso(
  m: EntityManager,
  curso: Curso,
): Promise<void> {
  const resultado = await m.update(
    EsquemaCurso,
    { idCurso: curso.idCurso },
    {
      nombre: curso.nombre,
      periodo: curso.periodo,
      ultimaSincronizacion: curso.ultimaSincronizacion,
    },
  );
  if (resultado.affected === 0) {
    throw new Error(
      `El curso ${curso.idCurso} no existe: los cursos se crean al guardar su docente`,
    );
  }
}

/** Escribe el registro. No escribe el estudiante ni el curso (deben existir). */
export async function escribirRegistro(
  m: EntityManager,
  registro: RegistroAcademico,
): Promise<void> {
  await m.upsert(
    EsquemaRegistroAcademico,
    {
      idRegistro: registro.idRegistro,
      nota: registro.nota,
      porcentajeAsistencia: registro.porcentajeAsistencia,
      idEstudiante: registro.estudiante.id,
      idCurso: registro.curso.idCurso,
    },
    ['idRegistro'],
  );
}

/** Escribe la alerta. No escribe su caso, docente ni registro. */
export async function escribirAlerta(
  m: EntityManager,
  alerta: Alerta,
): Promise<void> {
  await m.save(ModeloAlerta, {
    idOrigen: alerta.idOrigen,
    fecha: alerta.fecha,
    estado: alerta.estado,
    nivelRiesgo: alerta.nivelRiesgo,
    descripcion: alerta.descripcion,
    idDocente: alerta.docente.id,
    idRegistro: alerta.registro.idRegistro,
  });
}

/** Escribe la solicitud. No escribe su caso ni su estudiante. */
export async function escribirSolicitud(
  m: EntityManager,
  solicitud: SolicitudAcompanamiento,
): Promise<void> {
  await m.save(ModeloSolicitud, {
    idOrigen: solicitud.idOrigen,
    fecha: solicitud.fecha,
    estado: solicitud.estado,
    tipoApoyo: solicitud.tipoApoyo,
    motivo: solicitud.motivo,
    disponibilidad: solicitud.disponibilidad,
    idEstudiante: solicitud.obtenerEstudiante().id,
  });
}

/**
 * Jefe que dirige el programa (línea base §4: la bandeja del Jefe es su
 * programa). Sin jefe configurado lanza Error (plan de B2, respuesta 4).
 */
export async function jefeDelPrograma(
  m: EntityManager,
  idPrograma: string,
): Promise<string> {
  const jefe = await m.findOne(ModeloJefeDepartamento, {
    where: { idProgramaDirigido: idPrograma },
  });
  if (!jefe) {
    throw new Error(
      `No hay Jefe de Departamento configurado para el programa ${idPrograma}`,
    );
  }
  return jefe.id;
}

/**
 * Regla sin estado para `caso_riesgo.id_jefe` (respuesta 4 de Ivan): se fija
 * cuando la ruta no es nula Y el origen NO es una solicitud con tipoApoyo
 * PSICOLOGICA (esas nacen con ruta y no pasan por el jefe). En otro caso NULL.
 */
export async function derivarJefeDelCaso(
  m: EntityManager,
  caso: CasoRiesgo,
): Promise<string | null> {
  const nacioConRutaPsicologica =
    caso.origen instanceof SolicitudAcompanamiento &&
    caso.origen.tipoApoyo === RutaAtencion.PSICOLOGICA;
  if (caso.ruta === null || nacioConRutaPsicologica) {
    return null;
  }
  return jefeDelPrograma(
    m,
    caso.obtenerEstudiante().obtenerPrograma().idPrograma,
  );
}

function filaCita(
  cita: Cita,
): Pick<FilaCita, 'idCita' | 'fechaHora' | 'modalidad' | 'estado'> {
  return {
    idCita: cita.idCita,
    fechaHora: cita.fechaHora,
    modalidad: cita.modalidad,
    estado: cita.estado,
  };
}

function filaAsesoria(asesoria: Asesoria): Omit<FilaAsesoria, 'idCita'> {
  return {
    idAsesoria: asesoria.idAsesoria,
    fecha: asesoria.fecha,
    tipoAsesoria: asesoria.tipoAsesoria,
    observaciones: asesoria.observaciones,
    acuerdos: asesoria.acuerdos,
    asistencia: asesoria.asistencia,
    requiereSeguimiento: asesoria.requiereSeguimiento,
    presentaRiesgoCritico: asesoria.presentaRiesgoCritico,
  };
}

async function escribirAsesoriaDeCita(
  m: EntityManager,
  cita: Cita,
): Promise<void> {
  if (cita.asesoria) {
    await m.upsert(
      EsquemaAsesoria,
      { ...filaAsesoria(cita.asesoria), idCita: cita.idCita },
      ['idAsesoria'],
    );
  }
}

/**
 * Escribe el caso (agregado raíz con Cita, diagrama de clases v3) y en
 * cascada sus citas y las asesorías de esas citas.
 * - Citas nuevas: se insertan con `id_caso` y `id_psicologo = caso.psicologo`
 *   (asociación "agenda").
 * - Citas existentes: solo se actualizan sus atributos; `id_caso` e
 *   `id_psicologo` no cambian.
 * - No escribe el estudiante, el origen ni el psicólogo (deben existir).
 * - Verifica la coherencia estudiante–origen y deriva `id_jefe`.
 */
/**
 * Trazabilidad sin estado (respuesta 10 de Ivan en el plan de B7): fija una
 * sola vez la fecha de canalización (cuando el Jefe canalizó: `id_jefe` no
 * nulo) y la fecha y el psicólogo de la confirmación del consentimiento. Las
 * fechas las pone PostgreSQL al confirmar el cambio.
 */
async function trazarCaso(m: EntityManager, idCaso: string): Promise<void> {
  // B9 (R4): un solo UPDATE en lugar de dos. Las condiciones se evalúan sobre
  // la fila ANTERIOR, así que cada dato se fija una sola vez y nunca se
  // sobrescribe; si no hay nada que fijar, el WHERE no toca la fila.
  await m.query(
    `UPDATE caso_riesgo SET
       fecha_canalizacion = CASE
         WHEN id_jefe IS NOT NULL AND fecha_canalizacion IS NULL THEN now()
         ELSE fecha_canalizacion END,
       fecha_consentimiento = CASE
         WHEN consentimiento_confirmado AND id_psicologo IS NOT NULL
           AND fecha_consentimiento IS NULL THEN now()
         ELSE fecha_consentimiento END,
       id_psicologo_consentimiento = CASE
         WHEN consentimiento_confirmado AND id_psicologo IS NOT NULL
           AND fecha_consentimiento IS NULL THEN id_psicologo
         ELSE id_psicologo_consentimiento END
     WHERE id_caso = $1
       AND ((id_jefe IS NOT NULL AND fecha_canalizacion IS NULL)
         OR (consentimiento_confirmado AND id_psicologo IS NOT NULL
           AND fecha_consentimiento IS NULL))`,
    [idCaso],
  );
}

export async function escribirCaso(
  m: EntityManager,
  caso: CasoRiesgo,
): Promise<void> {
  verificarCoherenciaEstudianteOrigen(caso);
  const idJefe = await derivarJefeDelCaso(m, caso);
  await m.upsert(
    EsquemaCasoRiesgo,
    {
      idCaso: caso.idCaso,
      fechaCreacion: caso.fechaCreacion,
      motivo: caso.motivo,
      nivelRiesgo: caso.nivelRiesgo,
      ruta: caso.ruta,
      estado: caso.estado,
      justificacion: caso.justificacion,
      confidencialidad: caso.confidencialidad,
      consentimientoConfirmado: caso.consentimientoConfirmado,
      idEstudiante: caso.obtenerEstudiante().id,
      idOrigen: caso.origen.idOrigen,
      idPsicologo: caso.psicologo?.id ?? null,
      idJefe,
    },
    ['idCaso'],
  );
  await trazarCaso(m, caso.idCaso);

  const citas = caso.citas;
  if (citas.length === 0) {
    return;
  }
  const existentes = new Set(
    (
      await m.find(EsquemaCita, {
        select: { idCita: true },
        where: { idCita: In(citas.map((cita) => cita.idCita)) },
      })
    ).map((fila) => fila.idCita),
  );
  for (const cita of citas) {
    if (existentes.has(cita.idCita)) {
      await m.update(EsquemaCita, { idCita: cita.idCita }, filaCita(cita));
    } else {
      if (caso.psicologo === null) {
        throw new Error(`La cita ${cita.idCita} no tiene psicólogo en su caso`);
      }
      await m.insert(EsquemaCita, {
        ...filaCita(cita),
        idCaso: caso.idCaso,
        idPsicologo: caso.psicologo.id,
      });
    }
    await escribirAsesoriaDeCita(m, cita);
  }
}

/**
 * Solo ACTUALIZA una cita existente (fecha, modalidad, estado) y escribe en
 * cascada su asesoría. Las citas se insertan desde `guardar(caso)`, porque la
 * cita no conoce su caso ni su psicólogo.
 */
export async function escribirCita(
  m: EntityManager,
  cita: Cita,
): Promise<void> {
  const resultado = await m.update(
    EsquemaCita,
    { idCita: cita.idCita },
    filaCita(cita),
  );
  if (resultado.affected === 0) {
    throw new Error(
      `La cita ${cita.idCita} no existe: las citas se crean al guardar su caso`,
    );
  }
  await escribirAsesoriaDeCita(m, cita);
}

/**
 * Solo ACTUALIZA una asesoría existente. Las asesorías se insertan desde
 * `guardar(cita)` o `guardar(caso)`, porque la asesoría no conoce su cita.
 */
export async function escribirAsesoria(
  m: EntityManager,
  asesoria: Asesoria,
): Promise<void> {
  const resultado = await m.update(
    EsquemaAsesoria,
    { idAsesoria: asesoria.idAsesoria },
    filaAsesoria(asesoria),
  );
  if (resultado.affected === 0) {
    throw new Error(
      `La asesoría ${asesoria.idAsesoria} no existe: se crea al guardar su cita`,
    );
  }
}

/**
 * Escribe el plan y en cascada su asociación "refuerza" con los cursos
 * (agrega las que falten; nunca borra). No escribe el caso ni los cursos.
 * `id_jefe` ("estructura", 1) = jefe del programa del estudiante, con la
 * misma derivación que el caso (respuesta 4 de Ivan); sin jefe, Error.
 */
export async function escribirPlan(
  m: EntityManager,
  plan: PlanNivelacion,
): Promise<void> {
  const idJefe = await jefeDelPrograma(
    m,
    plan.obtenerEstudiante().obtenerPrograma().idPrograma,
  );
  await m.upsert(
    EsquemaPlanNivelacion,
    {
      idPlan: plan.idPlan,
      descripcion: plan.descripcion,
      fecha: plan.fecha,
      cronograma: plan.cronograma,
      tutorNombre: plan.tutorNombre,
      tutorCodigo: plan.tutorCodigo,
      estado: plan.estado,
      idCaso: plan.caso.idCaso,
      idJefe,
    },
    ['idPlan'],
  );
  await m
    .createQueryBuilder()
    .insert()
    .into(EsquemaPlanNivelacionCurso)
    .values(
      plan.cursos.map((curso) => ({
        idPlan: plan.idPlan,
        idCurso: curso.idCurso,
      })),
    )
    .orIgnore()
    .execute();
}

/**
 * Escribe el informe y en cascada sus asociaciones "resume" con casos y
 * planes (agrega las que falten). No escribe el curso, los casos ni los
 * planes. B8: con `autoria`, escribe también el programa y el autor (un Jefe
 * o un Psicólogo); sin ella, no toca esas columnas (un informe nuevo sin
 * autoría lo rechaza la BD: id_programa NOT NULL).
 */
export interface AutoriaInforme {
  idPrograma: string;
  idJefe: string | null;
  idPsicologo: string | null;
}

export async function escribirInforme(
  m: EntityManager,
  informe: InformeRiesgo,
  autoria?: AutoriaInforme,
): Promise<void> {
  await m.upsert(
    EsquemaInformeRiesgo,
    {
      ...autoria,
      idInforme: informe.idInforme,
      fecha: informe.fecha,
      periodo: informe.periodo,
      totalAlertas: informe.totalAlertas,
      totalCasos: informe.totalCasos,
      totalPlanes: informe.totalPlanes,
      resumen: informe.resumen,
      idCurso: informe.curso.idCurso,
    },
    ['idInforme'],
  );
  if (informe.casos.length > 0) {
    await m
      .createQueryBuilder()
      .insert()
      .into(EsquemaInformeRiesgoCaso)
      .values(
        informe.casos.map((caso) => ({
          idInforme: informe.idInforme,
          idCaso: caso.idCaso,
        })),
      )
      .orIgnore()
      .execute();
  }
  if (informe.planes.length > 0) {
    await m
      .createQueryBuilder()
      .insert()
      .into(EsquemaInformeRiesgoPlan)
      .values(
        informe.planes.map((plan) => ({
          idInforme: informe.idInforme,
          idPlan: plan.idPlan,
        })),
      )
      .orIgnore()
      .execute();
  }
}
