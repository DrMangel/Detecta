import { pedir } from './cliente';
import type { NivelRiesgo, TipoApoyo } from './estudiante';

/*
 * Rutas del Jefe de Departamento de Programa (F3). Contrato tomado de
 * ControladorCasosRiesgo y ControladorPlanNivelacion (B7 y B8;
 * back/src/controladores/respuestas-casos.ts y README). El Jefe sale de la
 * sesión: ninguna petición lleva su id ni su programa.
 *
 * Visibilidad (D18): `motivo` y `disponibilidad` solo llegan si el backend
 * permite verlos; las solicitudes psicosociales nunca llegan. `estudiante.id`
 * llega pero el front no lo muestra ni lo deja en el DOM (como en F2).
 */

/** Enumerado RutaAtencion: los mismos valores que el tipo de apoyo. */
export type RutaAtencion = TipoApoyo;

export type EstadoCaso =
  | 'PENDIENTE'
  | 'EN_NIVELACION'
  | 'EN_EVALUACION'
  | 'CITADO'
  | 'EN_SEGUIMIENTO'
  | 'CERRADO'
  | 'ARCHIVADO'
  | 'REORIENTADO';

export interface OrigenAlerta {
  tipo: 'ALERTA';
  idOrigen: string;
  fecha: string;
  curso: { idCurso: string; nombre: string; periodo: string };
  /** Justificación del docente (CUD04 paso 3). */
  descripcion: string;
  registro: { nota: number; porcentajeAsistencia: number };
}

export interface OrigenSolicitud {
  tipo: 'SOLICITUD';
  idOrigen: string;
  fecha: string;
  tipoApoyo: TipoApoyo;
  motivo?: string;
  disponibilidad?: string;
}

export interface Caso {
  idCaso: string;
  fechaCreacion: string;
  estado: EstadoCaso;
  ruta: RutaAtencion | null;
  nivelRiesgo: NivelRiesgo | null;
  estudiante: { id: string; nombre: string };
  origen: OrigenAlerta | OrigenSolicitud;
}

/** Registro académico del estudiante (antecedentes, CUD04 paso 3). */
export interface Antecedente {
  idRegistro: string;
  curso: { idCurso: string; nombre: string; periodo: string };
  nota: number;
  porcentajeAsistencia: number;
  ultimaSincronizacion: string | null;
}

export interface DetalleCaso {
  caso: Caso;
  antecedentes: Antecedente[];
}

export type EstadoPlan = 'ACTIVO' | 'FINALIZADO';

export interface Plan {
  idPlan: string;
  idCaso: string;
  fecha: string;
  estado: EstadoPlan;
  tutorNombre: string;
  tutorCodigo: string;
  cronograma: string;
  cursos: { idCurso: string; nombre: string; periodo: string }[];
}

export interface DatosPlan {
  idCaso: string;
  idsCursos: string[];
  tutorNombre: string;
  tutorCodigo: string;
  cronograma: string;
}

const rutaCaso = (idCaso: string) => `/casos/${encodeURIComponent(idCaso)}`;

/** sd_CUD04 `listarCasosPendiente`: bandeja del programa que dirige. */
export function consultarCasosPendientes(): Promise<Caso[]> {
  return pedir<Caso[]>({ metodo: 'GET', ruta: '/casos/pendientes' });
}

/** Detalle con la visibilidad aplicada y los antecedentes académicos. */
export function consultarCaso(idCaso: string): Promise<DetalleCaso> {
  return pedir<DetalleCaso>({ metodo: 'GET', ruta: rutaCaso(idCaso) });
}

/** sd_CUD04 `canalizarCaso(idCaso, ruta)`. */
export async function canalizarCaso(
  idCaso: string,
  ruta: RutaAtencion,
): Promise<Caso> {
  const respuesta = await pedir<{ mensaje: string; caso: Caso }>({
    metodo: 'POST',
    ruta: `${rutaCaso(idCaso)}/canalizacion`,
    cuerpo: { ruta },
  });
  return respuesta.caso;
}

/** sd_CUD04 (extensión CUD05) `estructurarPlan`. */
export async function registrarPlan(datos: DatosPlan): Promise<Plan> {
  const respuesta = await pedir<{ mensaje: string; plan: Plan }>({
    metodo: 'POST',
    ruta: '/planes',
    cuerpo: datos,
  });
  return respuesta.plan;
}

/** Extensión 1.a de CUD05: `finalizarPlan(idPlan)`. */
export async function finalizarPlan(idPlan: string): Promise<Plan> {
  const respuesta = await pedir<{ plan: Plan }>({
    metodo: 'POST',
    ruta: `/planes/${encodeURIComponent(idPlan)}/finalizacion`,
  });
  return respuesta.plan;
}
