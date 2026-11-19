import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorApi, TEXTO_ERROR_GENERICO } from '../servicios-api/errores';
import { useConsulta } from './use-consulta';

/*
 * Consulta al montar (F1b): datos o error con el texto uniforme de F0; la
 * respuesta de una consulta abandonada (otra clave, o el doble montaje de
 * StrictMode) se descarta.
 */
describe('useConsulta', () => {
  it('mientras consulta no hay datos ni error; luego, los datos', async () => {
    const { result } = renderHook(() =>
      useConsulta(() => Promise.resolve(['a']), 'clave'),
    );
    expect(result.current).toEqual({ datos: null, error: null });
    await waitFor(() =>
      expect(result.current).toEqual({ datos: ['a'], error: null }),
    );
  });

  it('fallo con ErrorApi: su texto; fallo no previsto: el genérico', async () => {
    const conErrorApi = renderHook(() =>
      useConsulta(
        () =>
          Promise.reject(
            new ErrorApi(503, 'Error al consultar la información'),
          ),
        'a',
      ),
    );
    await waitFor(() =>
      expect(conErrorApi.result.current.error).toBe(
        'Error al consultar la información',
      ),
    );
    const sinPrever = renderHook(() =>
      useConsulta(() => Promise.reject(new Error('x')), 'b'),
    );
    await waitFor(() =>
      expect(sinPrever.result.current.error).toBe(TEXTO_ERROR_GENERICO),
    );
    expect(sinPrever.result.current.datos).toBeNull();
  });

  it('otra clave: consulta de nuevo y descarta la respuesta anterior', async () => {
    let resolverPrimera: (valor: string) => void = () => undefined;
    const consultar = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolverPrimera = r;
          }),
      )
      .mockImplementationOnce(() => Promise.resolve('segunda'));
    const { result, rerender } = renderHook(
      ({ clave }) => useConsulta(consultar, clave),
      { initialProps: { clave: 'uno' } },
    );
    rerender({ clave: 'dos' });
    await waitFor(() => expect(result.current.datos).toBe('segunda'));
    resolverPrimera('primera');
    await Promise.resolve();
    expect(result.current.datos).toBe('segunda');
    expect(consultar).toHaveBeenCalledTimes(2);
  });
});
