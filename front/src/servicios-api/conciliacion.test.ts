import { describe, expect, it, vi } from 'vitest';
import { buscarNueva, enviarConConciliacion } from './conciliacion';
import { ErrorApi } from './errores';

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

/*
 * Envío con conciliación (ajuste A de F1b): devuelve «registrado» o
 * «incierto»; cualquier otro fallo se propaga para que useEnvio muestre su
 * texto. El 401 siempre se propaga (ProveedorSesion ya redirigió).
 */
const RED = new ErrorApi(null, 'sin conexión');
const SIN_SESION = new ErrorApi(401, 'Sesión no válida o caducada');
const NO_DISPONIBLE = new ErrorApi(503, 'Error al registrar');

function pasos(
  cambios: Partial<Parameters<typeof enviarConConciliacion<string>>[0]> = {},
) {
  return {
    consultarPrevias: vi.fn(() => Promise.resolve(new Set(['viejo']))),
    enviar: vi.fn(() => Promise.resolve('enviado')),
    buscar: vi.fn(() => Promise.resolve<string | null>('encontrado')),
    ...cambios,
  };
}

describe('enviarConConciliacion', () => {
  it('envío exitoso: registrado con lo que devolvió el envío', async () => {
    const p = pasos();
    expect(await enviarConConciliacion(p)).toEqual({
      tipo: 'registrado',
      valor: 'enviado',
    });
    expect(p.buscar).not.toHaveBeenCalled();
  });

  it('error de red y sí quedó registrado: registrado con lo encontrado, sin reenviar', async () => {
    const p = pasos({ enviar: vi.fn(() => Promise.reject(RED)) });
    expect(await enviarConConciliacion(p)).toEqual({
      tipo: 'registrado',
      valor: 'encontrado',
    });
    expect(p.enviar).toHaveBeenCalledTimes(1);
    expect(p.buscar).toHaveBeenCalledWith(new Set(['viejo']));
  });

  it('error de red y no quedó registrado: propaga el error de red', async () => {
    const p = pasos({
      enviar: vi.fn(() => Promise.reject(RED)),
      buscar: vi.fn(() => Promise.resolve(null)),
    });
    await expect(enviarConConciliacion(p)).rejects.toBe(RED);
  });

  it('la consulta previa falla: no bloquea el envío', async () => {
    const p = pasos({
      consultarPrevias: vi.fn(() => Promise.reject(NO_DISPONIBLE)),
    });
    expect(await enviarConConciliacion(p)).toEqual({
      tipo: 'registrado',
      valor: 'enviado',
    });
  });

  it('la consulta previa falla y luego hay error de red: incierto', async () => {
    const p = pasos({
      consultarPrevias: vi.fn(() => Promise.reject(RED)),
      enviar: vi.fn(() => Promise.reject(RED)),
    });
    expect(await enviarConConciliacion(p)).toEqual({ tipo: 'incierto' });
  });

  it('error de red y la verificación posterior falla: incierto', async () => {
    const p = pasos({
      enviar: vi.fn(() => Promise.reject(RED)),
      buscar: vi.fn(() => Promise.reject(RED)),
    });
    expect(await enviarConConciliacion(p)).toEqual({ tipo: 'incierto' });
  });

  it('otro fallo del envío (503): se propaga sin conciliar', async () => {
    const p = pasos({ enviar: vi.fn(() => Promise.reject(NO_DISPONIBLE)) });
    await expect(enviarConConciliacion(p)).rejects.toBe(NO_DISPONIBLE);
    expect(p.buscar).not.toHaveBeenCalled();
  });

  it('401 en la consulta previa: se propaga y no se envía', async () => {
    const p = pasos({
      consultarPrevias: vi.fn(() => Promise.reject(SIN_SESION)),
    });
    await expect(enviarConConciliacion(p)).rejects.toBe(SIN_SESION);
    expect(p.enviar).not.toHaveBeenCalled();
  });

  it('401 en la verificación posterior: se propaga', async () => {
    const p = pasos({
      enviar: vi.fn(() => Promise.reject(RED)),
      buscar: vi.fn(() => Promise.reject(SIN_SESION)),
    });
    await expect(enviarConConciliacion(p)).rejects.toBe(SIN_SESION);
  });
});
