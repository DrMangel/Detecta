import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi, TEXTO_ERROR_GENERICO } from '../servicios-api/errores';
import { useEnvio } from './use-envio';

/*
 * Envío de un formulario (F1b): estado «enviando», un solo envío a la vez,
 * error uniforme de F0 y espera del 429 (D15).
 */

function promesaPendiente<T>() {
  let resolver: (valor: T) => void = () => undefined;
  const promesa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promesa, resolver };
}

describe('useEnvio', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('éxito: devuelve el valor, marca «enviando» mientras dura y no deja error', async () => {
    const { result } = renderHook(() => useEnvio());
    const pendiente = promesaPendiente<string>();
    let resultado: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      resultado = result.current.ejecutar(() => pendiente.promesa);
    });
    expect(result.current.enviando).toBe(true);
    await act(async () => {
      pendiente.resolver('listo');
      expect(await resultado).toBe('listo');
    });
    expect(result.current.enviando).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fallo con ErrorApi: el texto del error y devuelve undefined', async () => {
    const { result } = renderHook(() => useEnvio());
    let valor: unknown = 'sin llamar';
    await act(async () => {
      valor = await result.current.ejecutar(() =>
        Promise.reject(new ErrorApi(503, 'Error al registrar la alerta')),
      );
    });
    expect(valor).toBeUndefined();
    expect(result.current.error).toBe('Error al registrar la alerta');
    expect(result.current.enviando).toBe(false);
  });

  it('fallo no previsto: el texto genérico de F0', async () => {
    const { result } = renderHook(() => useEnvio());
    await act(async () => {
      await result.current.ejecutar(() => Promise.reject(new Error('x')));
    });
    expect(result.current.error).toBe(TEXTO_ERROR_GENERICO);
  });

  it('429: queda en espera hasta que vence Retry-After', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEnvio());
    await act(async () => {
      await result.current.ejecutar(() =>
        Promise.reject(new ErrorApi(429, 'Demasiados intentos.', 30)),
      );
    });
    expect(result.current.enEspera).toBe(true);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.enEspera).toBe(false);
  });

  it('un solo envío a la vez: el segundo no ejecuta la acción', async () => {
    const { result } = renderHook(() => useEnvio());
    const pendiente = promesaPendiente<string>();
    const segunda = vi.fn(() => Promise.resolve('otra'));
    let primera: Promise<string | undefined> = Promise.resolve(undefined);
    let repetida: string | undefined = 'sin llamar';
    await act(async () => {
      primera = result.current.ejecutar(() => pendiente.promesa);
      repetida = await result.current.ejecutar(segunda);
    });
    expect(segunda).not.toHaveBeenCalled();
    expect(repetida).toBeUndefined();
    await act(async () => {
      pendiente.resolver('primera');
      await primera;
    });
  });

  it('un envío nuevo borra el error anterior; ponerError fija uno propio', async () => {
    const { result } = renderHook(() => useEnvio());
    act(() => {
      result.current.ponerError('Texto propio');
    });
    expect(result.current.error).toBe('Texto propio');
    await act(async () => {
      await result.current.ejecutar(() => Promise.resolve('ok'));
    });
    expect(result.current.error).toBeNull();
  });
});
