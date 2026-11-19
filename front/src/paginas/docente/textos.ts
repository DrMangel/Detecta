/*
 * Textos de las pantallas del Docente (F2), en los tres grupos del plan:
 * transcritos de los diagramas, el ER o el Manual; reutilizados del backend;
 * y nuevos (provisionales, aprobados por Ivan en el plan de F2, respuesta 5;
 * revisión de usabilidad en F5). Las etiquetas y los textos que comparte con
 * otros roles están en componentes/etiquetas.ts.
 */

import { ROTULOS_COMUNES } from '../../componentes/etiquetas';

/* ---------- Transcritos ---------- */

/** sd_CUD03 6.a; R01: «bloquea el envío notificando la omisión». */
export const TEXTO_CAMPOS_VACIOS =
  'Complete el nivel de riesgo y la justificación';

/** sd_CUD03: confirmación al docente (igual al `mensaje` del 201). */
export const TEXTO_ALERTA_EMITIDA =
  'Alerta emitida y remitida al Jefe de Departamento';

/* ---------- Nuevos (provisionales, plan de F2) ---------- */

export const TITULOS_DOCENTE = {
  consultaCurso: 'Consulta de curso',
  alertasEmitidas: 'Alertas emitidas',
} as const;

export const ROTULOS_DOCENTE = {
  ...ROTULOS_COMUNES,
  emitirAlerta: 'Emitir alerta',
  estadoAtencion: 'Estado de atención',
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
