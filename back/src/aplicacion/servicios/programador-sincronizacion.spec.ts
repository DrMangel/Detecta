import {
  msHastaProximaEjecucion,
  ProgramadorSincronizacion,
} from './programador-sincronizacion';
import type { ServicioSincronizacion } from './servicio-sincronizacion';

const MIN = 60_000;

describe('msHastaProximaEjecucion (hora de Bogotá, UTC-5)', () => {
  it('programa hoy si la hora aún no ha llegado', () => {
    // 2026-11-17 01:00 en Bogotá = 06:00 UTC; faltan 60 min para las 02:00.
    expect(
      msHastaProximaEjecucion(new Date('2026-11-17T06:00:00Z'), '02:00'),
    ).toBe(60 * MIN);
  });

  it('programa mañana si la hora ya pasó', () => {
    // 2026-11-17 03:00 en Bogotá = 08:00 UTC; la próxima 02:00 es mañana.
    expect(
      msHastaProximaEjecucion(new Date('2026-11-17T08:00:00Z'), '02:00'),
    ).toBe(23 * 60 * MIN);
  });

  it('a la hora exacta programa la del día siguiente', () => {
    expect(
      msHastaProximaEjecucion(new Date('2026-11-17T07:00:00Z'), '02:00'),
    ).toBe(24 * 60 * MIN);
  });

  it('cruza el cambio de día UTC correctamente', () => {
    // 2026-11-17 22:30 en Bogotá = 2026-11-18 03:30 UTC → 23:00 Bogotá en 30 min.
    expect(
      msHastaProximaEjecucion(new Date('2026-11-18T03:30:00Z'), '23:00'),
    ).toBe(30 * MIN);
  });
});

describe('ProgramadorSincronizacion', () => {
  afterEach(() => jest.useRealTimers());

  it('desactivado si no hay hora configurada', () => {
    const programador = new ProgramadorSincronizacion(
      {} as ServicioSincronizacion,
      { horaNocturna: null, secreto: null },
      () => new Date(),
    );
    expect(programador.iniciar()).toBe(false);
  });

  it('ejecuta sincronizarTodo a la hora programada y se reprograma', async () => {
    jest.useFakeTimers();
    const sincronizarTodo = jest.fn().mockResolvedValue(3);
    const servicio = {
      sincronizarTodo,
      obtenerUltimoResultado: () => null,
    } as unknown as ServicioSincronizacion;
    const programador = new ProgramadorSincronizacion(
      servicio,
      { horaNocturna: '02:00', secreto: null },
      () => new Date('2026-11-17T06:00:00Z'),
    );
    expect(programador.iniciar()).toBe(true);
    await jest.advanceTimersByTimeAsync(59 * MIN);
    expect(sincronizarTodo).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1 * MIN);
    expect(sincronizarTodo).toHaveBeenCalledTimes(1);
    programador.detener();
  });
});
