/*
 * Longitudes máximas del contrato (LONGITUD_MAXIMA en
 * back/src/controladores/validacion-entrada.ts). Los campos las usan en
 * maxLength para no provocar el 400 «El texto excede la longitud permitida.».
 */
export const LIMITES = {
  /** curso.periodo varchar(20) */
  periodo: 20,
  /** Identificadores (curso, registro) */
  identificador: 36,
  /** Justificación de la alerta */
  descripcion: 2000,
  motivo: 2000,
  disponibilidad: 500,
} as const;
