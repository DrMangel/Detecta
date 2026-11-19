import { middlewareCabeceras, SIN_CACHE } from './cabeceras-seguridad';

/** Cache-Control que fija el middleware para la URL y la cookie dadas. */
function cacheControl(url: string, cookie?: string): string | undefined {
  const cabeceras: Record<string, string> = {};
  middlewareCabeceras(false)(
    { url, headers: cookie === undefined ? {} : { cookie } },
    { setHeader: (nombre, valor) => (cabeceras[nombre] = valor) },
    () => undefined,
  );
  return cabeceras['Cache-Control'];
}

describe('middlewareCabeceras: sin caché (B9, ajuste E y ajuste 5)', () => {
  it.each([
    '/acceso',
    '/acceso/iniciar-sesion',
    '/acceso/activar?x=1',
    '/Acceso/Sesion',
  ])('%s responde no-store aunque no traiga cookie', (url) => {
    expect(cacheControl(url)).toBe(SIN_CACHE);
  });

  it.each(['/accesorios', '/casos/pendientes', '/', '/x/acceso/sesion'])(
    '%s sin cookie de sesión no fija Cache-Control',
    (url) => {
      expect(cacheControl(url)).toBeUndefined();
    },
  );

  it('cualquier ruta con la cookie de sesión responde no-store', () => {
    expect(cacheControl('/casos/pendientes', 'detecta_sesion=abc')).toBe(
      SIN_CACHE,
    );
  });
});
