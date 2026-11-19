import { describe, expect, it } from 'vitest';
import { LIMITES } from './limites';

/*
 * Límites de longitud del contrato (LONGITUD_MAXIMA de
 * back/src/controladores/validacion-entrada.ts). El front los usa en
 * maxLength para no provocar el 400 «El texto excede la longitud permitida.».
 */
describe('LIMITES', () => {
  it('coincide con LONGITUD_MAXIMA del backend', () => {
    expect(LIMITES).toEqual({
      periodo: 20,
      identificador: 36,
      descripcion: 2000,
      motivo: 2000,
      disponibilidad: 500,
    });
  });
});
