import type {
  EstadoPlan,
  RutaAtencion,
} from '../../servicios-api/jefe-departamento';
import type { TipoBandeja } from './plantilla-jefe-departamento';

/*
 * Textos de las pantallas del Jefe de Departamento de Programa (F3), en los
 * tres grupos del plan: transcritos de los diagramas, el ER o el Manual;
 * reutilizados del backend; y nuevos (provisionales, aprobados por Ivan en
 * el plan de F3, §4; revisión de usabilidad en F5). Los rótulos que
 * comparte con otros roles están en componentes/etiquetas.ts.
 */

/* ---------- Transcritos ---------- */

/** sd_CUD04, nota de IU_GestionCasos: «origen, nivel de riesgo, justificación y antecedentes académicos». */
export const ROTULOS_CASO = {
  origen: 'Origen',
  antecedentes: 'Antecedentes académicos',
} as const;

/** Nombres de CUD03 y CUD02 (Manual): el origen del caso. */
export const NOMBRE_ORIGEN = {
  ALERTA: 'Alerta académica temprana',
  SOLICITUD: 'Solicitud de acompañamiento',
} as const;

/** sd_CUD04 5.a de CUD05; mismo texto que el 400 del backend. */
export const TEXTO_FALTA_TUTOR = 'Faltan los datos del estudiante tutor';

/** sd_CUD04: confirmación del plan (igual al `mensaje` del 201). */
export const TEXTO_PLAN_REGISTRADO = 'Plan de nivelación registrado';

/**
 * Confirmación de la canalización: sd_CUD04 («Caso remitido a psicología»)
 * y el texto nuevo del backend para la ruta académica (plan de B7).
 */
export const TEXTO_CANALIZADO: Readonly<Record<RutaAtencion, string>> = {
  PSICOLOGICA: 'Caso remitido a psicología',
  ACADEMICA: 'Caso canalizado a la ruta académica',
};

/* ---------- Nuevos (provisionales, plan de F3, §4) ---------- */

export const TITULOS_JEFE = {
  casosPendientes: 'Casos pendientes',
  /** F5b, D38 (aprobado por Ivan). */
  rutaAcademica: 'En ruta académica',
  detalleCaso: 'Detalle del caso',
  informes: 'Informes de riesgo',
} as const;

export const ROTULOS_JEFE = {
  canalizarCaso: 'Canalizar caso',
  planNivelacion: 'Plan de nivelación',
  tutorNombre: 'Nombre del tutor',
  tutorCodigo: 'Código del tutor',
  cronograma: 'Cronograma (opcional)',
  cursosPlan: 'Cursos del plan',
  registrarPlan: 'Registrar plan',
  finalizarPlan: 'Finalizar plan',
  generarInforme: 'Generar informe',
  exportarPdf: 'Exportar PDF',
  totalAlertas: 'Total de alertas',
  totalCasos: 'Total de casos',
  totalPlanes: 'Total de planes',
} as const;

export const NOMBRE_RUTA: Readonly<Record<RutaAtencion, string>> = {
  ACADEMICA: 'Ruta académica',
  PSICOLOGICA: 'Ruta psicológica',
};

export const NOMBRE_ESTADO_PLAN: Readonly<Record<EstadoPlan, string>> = {
  ACTIVO: 'Activo',
  FINALIZADO: 'Finalizado',
};

/**
 * Enlace de regreso del detalle a su bandeja de origen (F5b; Manual
 * 3.1.2.2.6, Tabla 30, «Dar el control al usuario»; aprobado por Ivan).
 */
export const TEXTO_VOLVER: Readonly<Record<TipoBandeja, string>> = {
  pendientes: 'Volver a casos pendientes',
  rutaAcademica: 'Volver a casos en ruta académica',
};

export const TEXTO_SIN_CASOS = 'No hay casos pendientes';
/** F5b, D38 (aprobado por Ivan). */
export const TEXTO_SIN_CASOS_RUTA_ACADEMICA = 'No hay casos en ruta académica';
export const TEXTO_SIN_CURSOS = 'Seleccione al menos un curso';

/**
 * Error de red al registrar el plan (decisión de Ivan en F3): un segundo
 * POST /planes duplicaría el plan (D29) y no hay forma de conciliar (D38).
 */
export const TEXTO_PLAN_INCIERTO =
  'No se pudo confirmar si el plan fue registrado. Para evitar un plan duplicado, no puede registrarse de nuevo desde esta pantalla.';

/** Estado de carga del informe (ajuste E de F3). Fuera de la lista de §4. */
export const TEXTO_GENERANDO_INFORME = 'Generando el informe…';

/**
 * Tarjetas del inicio (especificación de diseño §7.0 y §8; provisionales).
 * «En ruta académica» la fijó Ivan en el plan de F5b-diseño (respuesta 5).
 */
export const DESCRIPCION_INICIO_JEFE = {
  casosPendientes:
    'Revisa los casos recibidos y canalízalos a la ruta académica o psicológica.',
  rutaAcademica:
    'Consulta los casos canalizados a la ruta académica y gestiona sus planes de nivelación.',
} as const;
