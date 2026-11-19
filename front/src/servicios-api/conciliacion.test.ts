import { describe, expect, it } from 'vitest';
import { buscarNueva } from './conciliacion';

/*
 * Conciliación tras un error de red (F1 y F2; plan de F1b): un elemento nuevo
 * es el que no estaba antes del envío y coincide con lo enviado.
 */

interface Elemento {
  id: string;
  texto: string;
}

const criterio = {
  clave: (e: Elemento) => e.id,
  coincide: (e: Elemento) => e.texto === 'enviado',
};

describe('buscarNueva', () => {
  it('devuelve el elemento nuevo que coincide', () => {
    const lista = [
      { id: 'viejo', texto: 'enviado' },
      { id: 'nuevo', texto: 'enviado' },
    ];
    expect(buscarNueva(new Set(['viejo']), lista, criterio)).toEqual({
      id: 'nuevo',
      texto: 'enviado',
    });
  });

  it('un elemento que ya estaba antes no cuenta, aunque coincida', () => {
    expect(
      buscarNueva(
        new Set(['viejo']),
        [{ id: 'viejo', texto: 'enviado' }],
        criterio,
      ),
    ).toBeNull();
  });

  it('un elemento nuevo que no coincide no cuenta', () => {
    expect(
      buscarNueva(new Set(), [{ id: 'nuevo', texto: 'otro' }], criterio),
    ).toBeNull();
  });

  it('lista vacía: null', () => {
    expect(buscarNueva(new Set(), [], criterio)).toBeNull();
  });
});
