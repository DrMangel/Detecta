import type {
  EstadoCaso,
  EstadoCita,
  Modalidad,
  RutaAtencion,
  TipoAsesoria,
} from '../../servicios-api/psicologo';

/* Textos de F4a: transcritos, reutilizados del backend o provisionales. */

export const TITULOS_PSICOLOGO = {
  /** Nuevo provisional de F4a. */
  remisiones: 'Remisiones',
  /** Nuevo provisional de F4a. */
  expediente: 'Expediente de atención psicológica',
} as const;

export const ROTULOS_PSICOLOGO = {
  casosSinAsignar: 'Sin asignar',
  casosAsignados: 'Asignadas a mí',
  verExpediente: 'Ver expediente',
  origen: 'Origen',
  ruta: 'Ruta de atención',
  antecedentes: 'Antecedentes académicos',
  citas: 'Citas',
  asesoria: 'Resultado de asesoría',
  modalidad: 'Modalidad',
  tipoAsesoria: 'Tipo de asesoría',
  observaciones: 'Observaciones',
  acuerdos: 'Acuerdos',
  asistencia: 'Asistencia',
  seguimiento: 'Requiere seguimiento',
  riesgoCritico: 'Presenta riesgo crítico',
  consentimiento: 'Consentimiento informado confirmado',
  psicologo: 'Psicólogo asignado',
  dictamen: 'Evaluar pertinencia',
  justificacion: 'Justificación',
  confirmarConsentimiento: 'Confirmar consentimiento',
} as const;

export const NOMBRE_ESTADO_CASO: Readonly<Record<EstadoCaso, string>> = {
  PENDIENTE: 'Pendiente',
  EN_NIVELACION: 'En nivelación',
  EN_EVALUACION: 'En evaluación',
  CITADO: 'Citado',
  EN_SEGUIMIENTO: 'En seguimiento',
  CERRADO: 'Cerrado',
  ARCHIVADO: 'Archivado',
  REORIENTADO: 'Reorientado',
};

/** Valores legibles provisionales, correspondientes a los enumerados del DTO. */
export const NOMBRE_MODALIDAD: Readonly<Record<Modalidad, string>> = {
  PRESENCIAL: 'Presencial',
  VIRTUAL: 'Virtual',
} as const;

export const NOMBRE_TIPO_ASESORIA: Readonly<Record<TipoAsesoria, string>> = {
  ORIENTACION: 'Orientación',
  SEGUIMIENTO: 'Seguimiento',
} as const;

export const NOMBRE_ESTADO_CITA: Readonly<Record<EstadoCita, string>> = {
  PROGRAMADA: 'Programada',
  REPROGRAMADA: 'Reprogramada',
  CERRADA: 'Cerrada',
} as const;

/** Nombres transcritos de los casos CUD03 y CUD02 del Manual. */
export const NOMBRE_ORIGEN_PSICOLOGO = {
  ALERTA: 'Alerta académica temprana',
  SOLICITUD: 'Solicitud de acompañamiento',
} as const;

export const NOMBRE_RUTA_PSICOLOGICA: Readonly<Record<RutaAtencion, string>> = {
  ACADEMICA: 'Académica',
  PSICOLOGICA: 'Psicológica',
};

export const OPCION_DICTAMEN = {
  APROBAR: 'Aprobar',
  ARCHIVAR: 'Archivar',
  REORIENTAR: 'Reorientar',
} as const;

export const TEXTO_JUSTIFICACION = 'Registre la justificación';
/** Texto reutilizado de ControladorPertinencia. */
export const TEXTO_REQUIERE_CONSENTIMIENTO =
  'La atención requiere el consentimiento informado del acudiente';
export const TEXTO_SIN_CASOS_PSICOLOGO = 'No hay remisiones para mostrar.';
export const TEXTO_SIN_ANTECEDENTES = 'Información no disponible';
export const TEXTO_RESULTADO_INCIERTO =
  'No se pudo confirmar el resultado. Para evitar repetir el dictamen, no puede enviarse de nuevo desde esta pantalla.';
export const TEXTO_CONSENTIMIENTO_CONFIRMADO =
  'El consentimiento informado está confirmado.';

/** El backend da un único mensaje con barra para los dos estados terminales. */
export const MENSAJE_DICTAMEN_POR_ESTADO = {
  EN_EVALUACION: 'Caso aprobado. Programe la cita',
  ARCHIVADO: 'Caso archivado',
  REORIENTADO: 'Caso reorientado',
} as const;
