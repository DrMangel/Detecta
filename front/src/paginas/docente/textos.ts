/*
 * Textos de las pantallas del Docente (F2), en los tres grupos del plan:
 * transcritos de los diagramas, el ER o el Manual; reutilizados del backend;
 * y nuevos (provisionales, aprobados por Ivan en el plan de F2, respuesta 5;
 * revisión de usabilidad en F5). Los valores de nivel de riesgo y de estado
 * se toman de paginas/estudiante/textos.ts (mismas fuentes que en F1).
 */

/* ---------- Transcritos ---------- */

/** sd_CUD01 4.a; ER 3.3.1. También si el curso nunca se sincronizó. */
export { TEXTO_INFORMACION_NO_DISPONIBLE } from '../estudiante/textos';

/** sd_CUD03 6.a; R01: «bloquea el envío notificando la omisión». */
export const TEXTO_CAMPOS_VACIOS =
  'Complete el nivel de riesgo y la justificación';

/** sd_CUD03: confirmación al docente (igual al `mensaje` del 201). */
export const TEXTO_ALERTA_EMITIDA =
  'Alerta emitida y remitida al Jefe de Departamento';

/* ---------- Reutilizados del backend ---------- */

export { TEXTO_INDIQUE_PERIODO } from '../estudiante/textos';

/* ---------- Nuevos (provisionales, plan de F2) ---------- */

export const TITULOS_DOCENTE = {
  consultaCurso: 'Consulta de curso',
  alertasEmitidas: 'Alertas emitidas',
} as const;

export const ROTULOS_DOCENTE = {
  codigoCurso: 'Código del curso',
  consultar: 'Consultar',
  curso: 'Curso',
  periodo: 'Periodo académico',
  ayudaPeriodo: 'Por ejemplo: 2026-2',
  ultimaSincronizacion: 'Última sincronización',
  estudiante: 'Estudiante',
  nota: 'Nota',
  asistencia: 'Asistencia',
  emitirAlerta: 'Emitir alerta',
  nivelRiesgo: 'Nivel de riesgo',
  /** R01 paso 4 y sd_CUD03 («la justificación»). */
  justificacion: 'Justificación',
  estadoAtencion: 'Estado de atención',
  fecha: 'Fecha',
  /**
   * Cierra el formulario sin emitir (ajuste B: «al cerrarlo»). No estaba en
   * la lista de §4: pendiente de confirmación en el informe de cierre.
   */
  cancelar: 'Cancelar',
} as const;

export const TEXTO_SIN_ALERTAS_EMITIDAS =
  'No ha emitido alertas en este periodo.';

/** Error de red con resultado incierto (§5 del plan; como en F1). */
export const TEXTO_ALERTA_INCIERTA =
  'No se pudo confirmar si la alerta fue registrada. Revise «Alertas emitidas» antes de emitirla de nuevo.';

/** Contador de la justificación (ajuste A): «120 / 2000». */
export function textoContador(usados: number, maximo: number): string {
  return `${usados} / ${maximo}`;
}
