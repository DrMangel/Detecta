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

/* ---------- Nuevos compartidos (provisionales, planes de F1 y F2) ---------- */

/**
 * Rótulos que repiten varios roles (F3: el Jefe usa los del Docente y del
 * Estudiante). «Justificación» viene de R01 y de sd_CUD03.
 */
export const ROTULOS_COMUNES = {
  codigoCurso: 'Código del curso',
  curso: 'Curso',
  estudiante: 'Estudiante',
  nota: 'Nota',
  asistencia: 'Asistencia',
  fecha: 'Fecha',
  estado: 'Estado',
  nivelRiesgo: 'Nivel de riesgo',
  justificacion: 'Justificación',
  tipoApoyo: 'Tipo de apoyo',
  motivo: 'Motivo',
  disponibilidad: 'Disponibilidad horaria',
  ultimaSincronizacion: 'Última sincronización',
  /** Psicólogo (F4) y Jefe (leyenda de la canalización, F5b-diseño D6). */
  rutaAtencion: 'Ruta de atención',
  /**
   * Cierra un formulario o un diálogo sin enviar: formulario de alerta del
   * Docente (F2, ajuste B) y diálogo de consentimiento del Psicólogo (§7.6).
   */
  cancelar: 'Cancelar',
} as const;

/** Consulta por periodo (FormularioPeriodo) y rótulos que la acompañan. */
export const ROTULOS_PERIODO = {
  periodo: 'Periodo académico',
  ayuda: 'Por ejemplo: 2026-2',
  consultar: 'Consultar',
} as const;

/**
 * Informes de riesgo (CUD10) que comparten el Jefe y el Psicólogo
 * (provisionales del plan de F3, §4; F4c). Antes en los textos del Jefe:
 * F5d los trae aquí para que componentes no dependa de paginas (Figura 16).
 */
export const ROTULOS_INFORME = {
  generarInforme: 'Generar informe',
  exportarPdf: 'Exportar PDF',
  totalAlertas: 'Total de alertas',
  totalCasos: 'Total de casos',
  totalPlanes: 'Total de planes',
} as const;

/** Estado de carga del informe (ajuste E de F3). */
export const TEXTO_GENERANDO_INFORME = 'Generando el informe…';
