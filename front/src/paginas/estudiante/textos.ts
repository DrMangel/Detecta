import type {
  EstadoAtencion,
  NivelRiesgo,
  TipoApoyo,
} from '../../servicios-api/estudiante';

/*
 * Textos de las pantallas del Estudiante (F1). Van en tres grupos, como pide
 * el plan aprobado: transcritos de los diagramas, el ER o el Manual;
 * reutilizados del backend; y nuevos (provisionales, aprobados por Ivan en
 * el plan de F1, respuesta 3 y ajuste B). Los demás textos del backend se
 * muestran tal cual llegan (servicios-api/errores.ts).
 */

/* ---------- Transcritos ---------- */

/** sd_CUD01 4.a; Manual CUD01 4.a: «sin asumir un valor» (ER 3.3.1). */
export const TEXTO_INFORMACION_NO_DISPONIBLE = 'Información no disponible';

/** sd_CUD02 4.a; Manual CUD02 5.a: «indica el campo omitido». */
export const TEXTO_MOTIVO_VACIO = 'Describa el motivo de la solicitud';

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

/** Valores de NivelRiesgo como los nombra docs/plan-front.md (F2). */
export const NOMBRE_NIVEL_RIESGO: Readonly<Record<NivelRiesgo, string>> = {
  BAJO: 'Bajo',
  MEDIO: 'Medio',
  ALTO: 'Alto',
};

/* ---------- Reutilizados del backend ---------- */

/** leerPeriodo (validacion-entrada.ts): el mismo texto antes de enviar. */
export const TEXTO_INDIQUE_PERIODO = 'Indique el periodo académico.';

/* ---------- Nuevos (provisionales, plan de F1) ---------- */

export const TITULOS_ESTUDIANTE = {
  consulta: 'Consulta académica',
  solicitudes: 'Mis solicitudes',
  nuevaSolicitud: 'Solicitar acompañamiento',
} as const;

export const ROTULOS_ESTUDIANTE = {
  periodo: 'Periodo académico',
  ayudaPeriodo: 'Por ejemplo: 2026-2',
  consultar: 'Consultar',
  asignatura: 'Asignatura',
  nota: 'Nota',
  asistencia: 'Asistencia',
  ultimaSincronizacion: 'Última sincronización',
  alertas: 'Alertas',
  fecha: 'Fecha',
  nivelRiesgo: 'Nivel de riesgo',
  descripcion: 'Descripción',
  tipoApoyo: 'Tipo de apoyo',
  motivo: 'Motivo',
  disponibilidad: 'Disponibilidad horaria',
  disponibilidadOpcional: 'Disponibilidad horaria (opcional)',
  estado: 'Estado',
  codigo: 'Código de rastreo',
  enviar: 'Enviar solicitud',
} as const;

export const TEXTO_SIN_ALERTAS =
  'No hay alertas registradas para este periodo.';
export const TEXTO_SIN_SOLICITUDES = 'Aún no ha registrado solicitudes.';

/**
 * Aviso de quién podrá ver la solicitud (ajuste B). Base: ER R02 paso 3
 * («El sistema informa al Estudiante, antes del envío, quién podrá ver su
 * solicitud según la categoría seleccionada: el Psicólogo si es psicosocial,
 * o el Jefe de Departamento de programa si es académica.») y Manual CUD02
 * paso 3 (igual, con «Jefe de Departamento de Programa»).
 */
export const AVISO_QUIEN_VE: Readonly<Record<TipoApoyo, string>> = {
  ACADEMICA: 'Podrá ver su solicitud el Jefe de Departamento de Programa.',
  PSICOLOGICA: 'Podrá ver su solicitud el Psicólogo.',
};

/**
 * Complemento del aviso académico (nota «Para el ER y F1» de la línea base
 * §4.2; Manual CUD02, requisitos especiales: «mientras el caso no sea
 * canalizado a la ruta psicológica»). El ER R02 se actualizará aparte.
 */
export const AVISO_REMISION_PSICOLOGIA =
  'Si lo considera necesario, podrá remitirla a psicología; en ese caso dejará de verla y la verá el Psicólogo.';

/** ER 1.3.4 (ajuste B). */
export const TEXTO_ASESORIA_EDUCATIVA =
  'El acompañamiento de DETECTA es una asesoría educativa y no una intervención clínica.';

/** Comprobante (ER 3.3.3: recibido, sin exponer quién lo hizo). */
export const TEXTO_SOLICITUD_RECIBIDA = 'Su solicitud fue recibida.';

/** Error de red con resultado incierto (sección i y ajuste C). */
export const TEXTO_RESULTADO_INCIERTO =
  'No se pudo confirmar si su solicitud fue registrada. Revise «Mis solicitudes» antes de enviarla de nuevo.';
