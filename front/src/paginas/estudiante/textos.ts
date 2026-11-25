import { ROTULOS_COMUNES } from '../../componentes/etiquetas';
import type { TipoApoyo } from '../../servicios-api/estudiante';

/*
 * Textos de las pantallas del Estudiante (F1). Van en tres grupos, como pide
 * el plan aprobado: transcritos de los diagramas, el ER o el Manual;
 * reutilizados del backend; y nuevos (provisionales, aprobados por Ivan en
 * el plan de F1, respuesta 3 y ajuste B). Las etiquetas y los textos que
 * comparte con otros roles están en componentes/etiquetas.ts; los demás
 * textos del backend se muestran tal cual llegan (servicios-api/errores.ts).
 */

/* ---------- Transcritos ---------- */

/**
 * sd_CUD02 4.a; Manual CUD02 5.a: «indica el campo omitido». Tuteado en
 * F5b-diseño (D4b): el rol Estudiante se dirige al estudiante en tú.
 */
export const TEXTO_MOTIVO_VACIO = 'Describe el motivo de tu solicitud';

/* ---------- Nuevos (provisionales, plan de F1) ---------- */

export const TITULOS_ESTUDIANTE = {
  consulta: 'Consulta académica',
  solicitudes: 'Mis solicitudes',
  nuevaSolicitud: 'Solicitar acompañamiento',
} as const;

export const ROTULOS_ESTUDIANTE = {
  ...ROTULOS_COMUNES,
  /** Rótulo de la cifra de nota (§8, aprobado en D4). */
  notaAcumulada: 'Nota acumulada',
  asignatura: 'Asignatura',
  alertas: 'Alertas',
  descripcion: 'Descripción',
  disponibilidadOpcional: 'Disponibilidad horaria (opcional)',
  codigo: 'Código de rastreo',
  enviar: 'Enviar solicitud',
} as const;

export const TEXTO_SIN_ALERTAS =
  'No hay alertas registradas para este periodo.';
export const TEXTO_SIN_SOLICITUDES = 'Aún no has registrado solicitudes.';

/**
 * Aviso de quién podrá ver la solicitud (ajuste B). Base: ER R02 paso 3
 * («El sistema informa al Estudiante, antes del envío, quién podrá ver su
 * solicitud según la categoría seleccionada: el Psicólogo si es psicosocial,
 * o el Jefe de Departamento de programa si es académica.») y Manual CUD02
 * paso 3 (igual, con «Jefe de Departamento de Programa»).
 */
export const AVISO_QUIEN_VE: Readonly<Record<TipoApoyo, string>> = {
  ACADEMICA: 'Podrá ver tu solicitud el Jefe de Departamento de Programa.',
  PSICOLOGICA: 'Podrá ver tu solicitud el Psicólogo.',
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
export const TEXTO_SOLICITUD_RECIBIDA = 'Tu solicitud fue recibida.';

/** Error de red con resultado incierto (sección i y ajuste C). */
export const TEXTO_RESULTADO_INCIERTO =
  'No se pudo confirmar si tu solicitud fue registrada. Revisa «Mis solicitudes» antes de enviarla de nuevo.';

/**
 * Tarjetas del inicio (especificación de diseño §7.0 y §8; provisionales).
 * La de la solicitud no promete más que ER 3.5.3 (decisión de Ivan en D4).
 */
export const DESCRIPCION_INICIO_ESTUDIANTE = {
  consulta: 'Revisa tus notas, tu asistencia y tus alertas por periodo.',
  solicitudes:
    'Consulta el estado de las solicitudes de acompañamiento que has enviado.',
  nuevaSolicitud:
    'Pide apoyo académico o psicosocial. Tu solicitud solo la ve el personal que la atiende.',
} as const;

/* ---------- Nuevos de F5b-diseño (D4b; provisionales, §8) ---------- */

/** Ayudas bajo el título (§7.2 y §8; la de la solicitud, decisión 2 de D4). */
export const AYUDA_ESTUDIANTE = {
  consulta: 'Aquí puedes ver cómo vas en tus asignaturas.',
  solicitud:
    'Cuéntanos qué necesitas; tu solicitud se trata con respeto y confidencialidad.',
} as const;

/** «Mis asignaturas · 2026-2» (§8). */
export function tituloAsignaturas(periodo: string): string {
  return `Mis asignaturas · ${periodo}`;
}

/** «Riesgo medio · Física I» (§7.2): el nivel en minúscula. */
export function tituloAvisoRiesgo(nivel: string, asignatura: string): string {
  return `Riesgo ${nivel.toLocaleLowerCase('es-CO')} · ${asignatura}`;
}

/**
 * Periodo vacío en la consulta del Estudiante, tuteado (decisión 1 de D4).
 * El texto compartido y el del backend siguen en usted (limitación aceptada).
 */
export const TEXTO_INDICA_PERIODO = 'Indica el periodo académico.';

/** Aviso antes de elegir el tipo de apoyo (§8; se integra con R02, 4b de D4). */
export const AVISO_GENERAL_SOLICITUD =
  'Las solicitudes académicas las atiende el Programa. Las psicosociales solo las verá el área de Psicología; el Jefe de Departamento no tendrá acceso a ellas.';

/**
 * Complemento del aviso psicosocial (D4b). Lo garantiza el backend: el Jefe
 * nunca recibe solicitudes psicosociales (D18; buscarParaPrograma y la
 * bandeja las excluyen en SQL; puedeVerContenidoConfidencial).
 */
export const AVISO_SIN_JEFE =
  'El Jefe de Departamento no tendrá acceso a ella.';
