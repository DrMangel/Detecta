import { describe, expect, it } from 'vitest';
import { primerNombre } from './formato';
import { saludo } from './textos';

/* Saludo del inicio (especificación de diseño §7.0 y §8): «Hola, {primer nombre}». */

describe('saludo', () => {
  it.each([
    ['María José Pérez', 'Hola, María'],
    ['  Ana   Pérez ', 'Hola, Ana'],
    ['Ángela Ñúñez', 'Hola, Ángela'],
    ['', 'Hola'],
    ['   ', 'Hola'],
  ])('«%s» → «%s»', (nombre, texto) => {
    expect(saludo(primerNombre(nombre))).toBe(texto);
  });
});
