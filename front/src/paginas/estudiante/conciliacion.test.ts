import { describe, expect, it } from 'vitest';
import type { Solicitud } from '../../servicios-api/estudiante';
import { buscarRegistrada } from './conciliacion';

/* Conciliación tras un error de red (plan de F1, sección i). */

const DATOS = {
  tipoApoyo: 'PSICOLOGICA' as const,
  motivo: 'Motivo',
  disponibilidad: '',
};

function solicitud(
  codigo: string,
  cambios: Partial<Solicitud> = {},
): Solicitud {
  return {
    codigo,
    fecha: '2026-11-19T15:00:00.000Z',
    estado: 'PENDIENTE',
    ...DATOS,
    ...cambios,
  };
}

describe('buscarRegistrada', () => {
  it('encuentra la solicitud nueva con el mismo tipo, motivo y disponibilidad', () => {
    const lista = [solicitud('nueva'), solicitud('vieja')];
    expect(buscarRegistrada(new Set(['vieja']), lista, DATOS)?.codigo).toBe(
      'nueva',
    );
  });

  it('una idéntica que ya existía antes del envío no cuenta', () => {
    expect(
      buscarRegistrada(new Set(['vieja']), [solicitud('vieja')], DATOS),
    ).toBeNull();
  });

  it.each<[string, Partial<Solicitud>]>([
    ['otro tipo', { tipoApoyo: 'ACADEMICA' }],
    ['otro motivo', { motivo: 'Otro' }],
    ['otra disponibilidad', { disponibilidad: 'Lunes' }],
  ])('una nueva con %s no cuenta', (_caso, cambios) => {
    expect(
      buscarRegistrada(new Set(), [solicitud('nueva', cambios)], DATOS),
    ).toBeNull();
  });
});
