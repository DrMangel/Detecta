import { describe, expect, it } from 'vitest';
import {
  formatearAsistencia,
  formatearFecha,
  formatearFechaHora,
  formatearNota,
} from './formato';

/* Formato es-CO aprobado en F1 (respuesta 8). */

describe('formato es-CO', () => {
  it.each([
    [3.45, '3,45'],
    [0, '0,00'],
    [5, '5,00'],
  ])('nota %s → %s', (nota, texto) => {
    expect(formatearNota(nota)).toBe(texto);
  });

  it.each([
    [87.5, '87,50 %'],
    [0, '0,00 %'],
    [100, '100,00 %'],
  ])('asistencia %s → %s', (porcentaje, texto) => {
    expect(formatearAsistencia(porcentaje)).toBe(texto);
  });

  it('fecha y hora dd/mm/aaaa hh:mm de Bogotá en 24 horas (F2, respuesta 3)', () => {
    expect(formatearFechaHora('2026-11-19T08:00:00.000Z')).toBe(
      '19/11/2026 03:00',
    );
    expect(formatearFechaHora('2026-11-20T04:59:00.000Z')).toBe(
      '19/11/2026 23:59',
    );
    expect(formatearFechaHora('2026-11-19T17:05:00.000Z')).toBe(
      '19/11/2026 12:05',
    );
  });

  it('fecha dd/mm/aaaa en hora de Bogotá (UTC−5)', () => {
    expect(formatearFecha('2026-11-19T15:00:00.000Z')).toBe('19/11/2026');
    expect(formatearFecha('2026-11-20T03:00:00.000Z')).toBe('19/11/2026');
    expect(formatearFecha('2026-11-20T05:00:00.000Z')).toBe('20/11/2026');
  });
});
