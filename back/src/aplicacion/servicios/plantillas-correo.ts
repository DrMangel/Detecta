import type { Cita } from '../../dominio/entidades/cita';
import { EstadoCita } from '../../dominio/entidades/estado-cita';
import { Modalidad } from '../../dominio/entidades/modalidad';

/*
 * Plantillas HTML de las notificaciones (ER Tabla 1: formato HTML; B5).
 *
 * Sin contenido confidencial (Manual 4.1.1.6: "los mensajes comunican
 * alertas, citas, casos remitidos y planes de nivelación sin incluir el
 * motivo del caso ni el contenido de las asesorías, y remiten al usuario al
 * sistema para consultar el detalle").
 * - Alerta: solo el nombre del curso (sin nivel ni descripción).
 * - Caso remitido: sin motivo ni estudiante.
 * - Cita: "programada"/"reprogramada", fecha, hora y modalidad; sin mencionar
 *   psicología ni el caso (respuesta 2 de Ivan). Si el estudiante es menor y
 *   falta el consentimiento, una línea genérica de requisitos previos (R05
 *   paso 6; respuesta 3 del plan de B7), también sin mencionar psicología.
 * - Plan: genérico (el Manual no confirma explícitamente que los cursos no
 *   sean confidenciales; respuesta 2).
 *
 * Todo valor dinámico se escapa en HTML y ningún asunto admite saltos de
 * línea (ajuste C).
 */

export interface MensajeCorreo {
  asunto: string;
  cuerpoHtml: string;
}

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Bogotá: fechas y horas de la cita en la hora local de la institución. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const FORMATO_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const MODALIDADES: Record<Modalidad, string> = {
  [Modalidad.PRESENCIAL]: 'presencial',
  [Modalidad.VIRTUAL]: 'virtual',
};

function documento(
  nombre: string,
  parrafos: string[],
  urlFrontend: string,
): string {
  const enlace = escaparHtml(urlFrontend);
  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head><meta charset="utf-8"><title>DETECTA</title></head>',
    '<body>',
    `<p>Hola, ${escaparHtml(nombre)}.</p>`,
    ...parrafos.map((parrafo) => `<p>${parrafo}</p>`),
    `<p>Ingrese a DETECTA para consultar el detalle: <a href="${enlace}">${enlace}</a></p>`,
    '</body>',
    '</html>',
  ].join('\n');
}

export function plantillaAlerta(
  nombre: string,
  nombreCurso: string,
  urlFrontend: string,
): MensajeCorreo {
  return {
    asunto: 'DETECTA: nueva alerta académica',
    cuerpoHtml: documento(
      nombre,
      [
        `Se emitió una alerta académica en el curso ${escaparHtml(nombreCurso)}.`,
      ],
      urlFrontend,
    ),
  };
}

export function plantillaCasoRemitido(
  nombre: string,
  urlFrontend: string,
): MensajeCorreo {
  return {
    asunto: 'DETECTA: caso remitido para su gestión',
    cuerpoHtml: documento(
      nombre,
      ['Tiene un caso de riesgo remitido para su gestión.'],
      urlFrontend,
    ),
  };
}

/** Requisito previo genérico (respuesta 3 del plan de B7). */
export const LINEA_CONSENTIMIENTO =
  'Antes de la cita debe presentar el consentimiento informado firmado por su acudiente.';

export function plantillaCita(
  nombre: string,
  cita: Cita,
  urlFrontend: string,
  requiereConsentimiento = false,
): MensajeCorreo {
  const tipo =
    cita.estado === EstadoCita.REPROGRAMADA ? 'reprogramada' : 'programada';
  const fecha = FORMATO_FECHA.format(cita.fechaHora);
  const hora = FORMATO_HORA.format(cita.fechaHora);
  return {
    asunto: `DETECTA: cita ${tipo}`,
    cuerpoHtml: documento(
      nombre,
      [
        `Tiene una cita ${tipo} para el ${escaparHtml(fecha)} a las ${escaparHtml(hora)}, modalidad ${escaparHtml(MODALIDADES[cita.modalidad])}.`,
        ...(requiereConsentimiento ? [LINEA_CONSENTIMIENTO] : []),
      ],
      urlFrontend,
    ),
  };
}

export function plantillaPlanNivelacion(
  nombre: string,
  urlFrontend: string,
): MensajeCorreo {
  return {
    asunto: 'DETECTA: plan de nivelación académica',
    cuerpoHtml: documento(
      nombre,
      ['Se registró un plan de nivelación académica para usted.'],
      urlFrontend,
    ),
  };
}
