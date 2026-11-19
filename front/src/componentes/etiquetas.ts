import type {
  EstadoAtencion,
  NivelRiesgo,
  TipoApoyo,
} from '../servicios-api/estudiante';

/*
 * Etiquetas y textos que comparten varios roles (F1b). Cada uno conserva la
 * fuente de la que se transcribió o el texto del backend que reutiliza.
 */

/* ---------- Transcritos ---------- */

/** sd_CUD01 4.a; Manual CUD01 4.a: «sin asumir un valor» (ER 3.3.1). */
export const TEXTO_INFORMACION_NO_DISPONIBLE = 'Información no disponible';

/** R02 y Manual CUD02 paso 2: «académico o psicosocial». */
export const NOMBRE_TIPO_APOYO: Readonly<Record<TipoApoyo, string>> = {
  ACADEMICA: 'Académico',
  PSICOLOGICA: 'Psicosocial',
};

/** Manual CUD01 2.b: «pendiente o atendida» (D27). */
export const NOMBRE_ESTADO: Readonly<Record<EstadoAtencion, string>> = {
  PENDIENTE: 'Pendiente',
  ATENDIDA: 'Atendida',
};

/** Manual CUD03 («bajo, medio o alto»); docs/plan-front.md (F2). */
export const NOMBRE_NIVEL_RIESGO: Readonly<Record<NivelRiesgo, string>> = {
  BAJO: 'Bajo',
  MEDIO: 'Medio',
  ALTO: 'Alto',
};

/* ---------- Reutilizados del backend ---------- */

/** leerPeriodo (validacion-entrada.ts): el mismo texto antes de enviar. */
export const TEXTO_INDIQUE_PERIODO = 'Indique el periodo académico.';
