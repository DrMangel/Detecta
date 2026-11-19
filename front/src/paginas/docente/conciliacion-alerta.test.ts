import { describe, expect, it } from 'vitest';
import type { AlertaEmitida } from '../../servicios-api/docente';
import {
  buscarAlertaRegistrada,
  type AlertaEnviada,
} from './conciliacion-alerta';

/* Conciliación de una alerta tras un error de red (plan de F2, §5). */

const ENVIADA: AlertaEnviada = {
  idCurso: 'IS-101',
  idEstudiante: 'est-1',
  nivelRiesgo: 'MEDIO',
  descripcion: 'Justificación',
};

function alerta(idAlerta: string, cambios: Partial<AlertaEmitida> = {}) {
  return {
    idAlerta,
    fecha: '2026-11-19T15:00:00.000Z',
    curso: { idCurso: 'IS-101', nombre: 'Curso' },
    estudiante: { id: 'est-1', nombre: 'Ana' },
    nivelRiesgo: 'MEDIO',
    descripcion: 'Justificación',
    estadoAtencion: 'PENDIENTE',
    ...cambios,
  } satisfies AlertaEmitida;
}

describe('buscarAlertaRegistrada', () => {
  it('encuentra la alerta nueva del mismo curso, estudiante, nivel y descripción', () => {
    const lista = [alerta('vieja'), alerta('nueva')];
    expect(
      buscarAlertaRegistrada(new Set(['vieja']), lista, ENVIADA)?.idAlerta,
    ).toBe('nueva');
  });

  it('una idéntica que ya existía antes del envío no cuenta', () => {
    expect(
      buscarAlertaRegistrada(new Set(['vieja']), [alerta('vieja')], ENVIADA),
    ).toBeNull();
  });

  it.each<[string, Partial<AlertaEmitida>]>([
    ['otro curso', { curso: { idCurso: 'CI-201', nombre: 'Otro' } }],
    ['otro estudiante', { estudiante: { id: 'est-2', nombre: 'Luis' } }],
    ['otro nivel', { nivelRiesgo: 'ALTO' }],
    ['otra descripción', { descripcion: 'Otra' }],
  ])('una nueva con %s no cuenta', (_caso, cambios) => {
    expect(
      buscarAlertaRegistrada(new Set(), [alerta('nueva', cambios)], ENVIADA),
    ).toBeNull();
  });
});
