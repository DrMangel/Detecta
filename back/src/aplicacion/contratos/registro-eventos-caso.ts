import type { Modalidad } from '../../dominio/entidades/modalidad';

/*
 * Contrato `RegistroEventosCaso` (fase B9, trazabilidad; diseño del informe
 * parcial 1 aprobado por Ivan). NO está en el diagrama de clases v3: se
 * reporta como diferencia, junto con la tabla `evento_caso` y
 * `RepositoriosTransaccionales.eventos`.
 *
 * Cubre lo que el ER 1.3.4 («qué acciones se tomaron») y CUD04 (requisitos
 * especiales: «creación, remisión y seguimiento… quedan registrados de forma
 * trazable») exigen y el esquema no guardaba: fecha y autor del dictamen, del
 * cierre, de la finalización del plan, del agendamiento de cada cita y el
 * historial de reprogramaciones (antes la fecha anterior se sobrescribía).
 *
 * Solo identificadores, el tipo y fechas: nunca el motivo, la justificación,
 * las observaciones, los acuerdos ni ningún contenido de las asesorías
 * (D18, D19). La hora del evento la pone PostgreSQL (`now()`, la de la
 * transacción), como `trazarCaso`.
 *
 * Lo que ya tiene traza no se duplica: creación del caso (`fecha_creacion` y
 * el origen), canalización (`id_jefe`, `fecha_canalizacion`), consentimiento
 * (B7), asesoría (`asesoria.fecha`) y creación del plan (`fecha`, `id_jefe`).
 */

export const TipoEventoCaso = {
  DICTAMEN_APROBADO: 'DICTAMEN_APROBADO',
  DICTAMEN_ARCHIVADO: 'DICTAMEN_ARCHIVADO',
  DICTAMEN_REORIENTADO: 'DICTAMEN_REORIENTADO',
  CASO_CERRADO: 'CASO_CERRADO',
  PLAN_FINALIZADO: 'PLAN_FINALIZADO',
  CITA_PROGRAMADA: 'CITA_PROGRAMADA',
  CITA_REPROGRAMADA: 'CITA_REPROGRAMADA',
} as const;

export type TipoEventoCaso =
  (typeof TipoEventoCaso)[keyof typeof TipoEventoCaso];

interface EventoBase {
  idCaso: string;
  /** Quién ejecutó la acción: el usuario de la sesión. */
  idActor: string;
}

/** Dictamen de pertinencia (CUD07) o cierre del caso (sd_CUD06, 6.b). */
export interface EventoDelCaso extends EventoBase {
  tipo:
    | typeof TipoEventoCaso.DICTAMEN_APROBADO
    | typeof TipoEventoCaso.DICTAMEN_ARCHIVADO
    | typeof TipoEventoCaso.DICTAMEN_REORIENTADO
    | typeof TipoEventoCaso.CASO_CERRADO;
}

/** Finalización del plan (CUD05, 1.a); `idCaso` es el caso del que nace. */
export interface EventoPlanFinalizado extends EventoBase {
  tipo: typeof TipoEventoCaso.PLAN_FINALIZADO;
  idPlan: string;
}

/** Cita o seguimiento agendados (CUD07 pasos 3 a 6; sd_CUD06, 6.a). */
export interface EventoCitaProgramada extends EventoBase {
  tipo: typeof TipoEventoCaso.CITA_PROGRAMADA;
  idCita: string;
}

/**
 * Reprogramación (sd_CUD06, 4.a). Lleva la modalidad porque B7 permite
 * cambiar solo la modalidad.
 */
export interface EventoCitaReprogramada extends EventoBase {
  tipo: typeof TipoEventoCaso.CITA_REPROGRAMADA;
  idCita: string;
  fechaHoraAnterior: Date;
  fechaHoraNueva: Date;
  modalidadAnterior: Modalidad;
  modalidadNueva: Modalidad;
}

export type EventoCaso =
  | EventoDelCaso
  | EventoPlanFinalizado
  | EventoCitaProgramada
  | EventoCitaReprogramada;

export interface RegistroEventosCaso {
  /**
   * Inserta el evento en la transacción de la `UnidadTrabajo`: se confirma o
   * se revierte junto con la acción que registra. Solo inserción: no hay
   * métodos para modificar ni borrar (detecta_app tampoco tiene esos
   * permisos sobre `evento_caso`).
   */
  registrar(evento: EventoCaso): Promise<void>;
}
