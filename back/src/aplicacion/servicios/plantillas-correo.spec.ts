import { problemasHtml } from '../../../test/verificar-html';
import { Cita } from '../../dominio/entidades/cita';
import { EstadoCita } from '../../dominio/entidades/estado-cita';
import { Modalidad } from '../../dominio/entidades/modalidad';
import {
  escaparHtml,
  plantillaAlerta,
  plantillaCasoRemitido,
  plantillaCita,
  plantillaPlanNivelacion,
  type MensajeCorreo,
} from './plantillas-correo';

const URL = 'http://localhost:5173';
const MALICIOSO = `<script>alert("x")</script> & 'O"Neil'`;

function cita(estado: EstadoCita, modalidad = Modalidad.VIRTUAL): Cita {
  return new Cita({
    idCita: 'CI1',
    // 20/11/2026 14:30 en Bogotá (UTC-5)
    fechaHora: new Date('2026-11-20T19:30:00Z'),
    modalidad,
    estado,
    asesoria: null,
  });
}

const TODAS: [string, MensajeCorreo][] = [
  ['alerta', plantillaAlerta(MALICIOSO, MALICIOSO, URL)],
  ['caso remitido', plantillaCasoRemitido(MALICIOSO, URL)],
  ['cita', plantillaCita(MALICIOSO, cita(EstadoCita.PROGRAMADA), URL)],
  ['plan', plantillaPlanNivelacion(MALICIOSO, URL)],
];

describe('Plantillas de correo (B5, ER Tabla 1)', () => {
  it('escaparHtml escapa los cinco caracteres especiales', () => {
    expect(escaparHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it.each(TODAS)(
    '%s: HTML válido con los valores dinámicos escapados (ajuste C)',
    (_tipo, mensaje) => {
      expect(problemasHtml(mensaje.cuerpoHtml)).toEqual([]);
      expect(mensaje.cuerpoHtml).toMatch(/^<!DOCTYPE html>/);
      expect(mensaje.cuerpoHtml).not.toContain('<script>');
      expect(mensaje.cuerpoHtml).toContain(
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;O&quot;Neil&#39;',
      );
      expect(mensaje.cuerpoHtml).toContain(`<a href="${URL}">${URL}</a>`);
    },
  );

  it.each(TODAS)('%s: el asunto no tiene saltos de línea', (_tipo, mensaje) => {
    expect(mensaje.asunto).not.toMatch(/[\r\n]/);
    expect(mensaje.asunto.startsWith('DETECTA: ')).toBe(true);
  });

  it('la URL del frontend también se escapa', () => {
    const { cuerpoHtml } = plantillaPlanNivelacion(
      'Ana',
      'http://x.test/"><script>',
    );
    expect(problemasHtml(cuerpoHtml)).toEqual([]);
    expect(cuerpoHtml).toContain(
      'href="http://x.test/&quot;&gt;&lt;script&gt;"',
    );
  });

  it('alerta: solo el nombre del curso, sin nivel ni descripción', () => {
    const { asunto, cuerpoHtml } = plantillaAlerta('Ana', 'Cálculo', URL);
    expect(asunto).toBe('DETECTA: nueva alerta académica');
    expect(cuerpoHtml).toContain(
      'Se emitió una alerta académica en el curso Cálculo.',
    );
  });

  it('caso remitido: genérico, sin motivo ni estudiante', () => {
    const { asunto, cuerpoHtml } = plantillaCasoRemitido('Psicóloga', URL);
    expect(asunto).toBe('DETECTA: caso remitido para su gestión');
    expect(cuerpoHtml).toContain(
      'Tiene un caso de riesgo remitido para su gestión.',
    );
  });

  it('cita programada: fecha, hora (Bogotá) y modalidad, sin psicología ni caso (respuesta 2)', () => {
    const { asunto, cuerpoHtml } = plantillaCita(
      'Ana',
      cita(EstadoCita.PROGRAMADA),
      URL,
    );
    expect(asunto).toBe('DETECTA: cita programada');
    expect(cuerpoHtml).toContain(
      'Tiene una cita programada para el 20/11/2026 a las 14:30, modalidad virtual.',
    );
    expect(`${asunto} ${cuerpoHtml}`).not.toMatch(/psic|caso|asesor/i);
  });

  it('cita reprogramada y presencial', () => {
    const { asunto, cuerpoHtml } = plantillaCita(
      'Ana',
      cita(EstadoCita.REPROGRAMADA, Modalidad.PRESENCIAL),
      URL,
    );
    expect(asunto).toBe('DETECTA: cita reprogramada');
    expect(cuerpoHtml).toContain('Tiene una cita reprogramada para el');
    expect(cuerpoHtml).toContain('modalidad presencial.');
  });

  it('plan de nivelación: genérico, sin cursos (respuesta 2)', () => {
    const { asunto, cuerpoHtml } = plantillaPlanNivelacion('Ana', URL);
    expect(asunto).toBe('DETECTA: plan de nivelación académica');
    expect(cuerpoHtml).toContain(
      'Se registró un plan de nivelación académica para usted.',
    );
  });

  it('cita con requiereConsentimiento: agrega la línea genérica, sin mencionar psicología (B7, respuesta 3)', () => {
    const con = plantillaCita('Ana', cita(EstadoCita.PROGRAMADA), URL, true);
    expect(con.cuerpoHtml).toContain(
      '<p>Antes de la cita debe presentar el consentimiento informado firmado por su acudiente.</p>',
    );
    expect(problemasHtml(con.cuerpoHtml)).toEqual([]);
    expect(`${con.asunto} ${con.cuerpoHtml}`).not.toMatch(/psic|caso|asesor/i);
    const sin = plantillaCita('Ana', cita(EstadoCita.PROGRAMADA), URL);
    expect(sin.cuerpoHtml).not.toContain('consentimiento');
  });
});
