import { describe, expect, it, vi } from 'vitest';
import { SIN_SESION, simularApi } from '../pruebas/utilidades';
import { consultarSesion, iniciarSesion } from './acceso';
import { descargar, pedir, registrarSesionInvalida } from './cliente';
import { ErrorApi, TEXTO_ERROR_RED, TEXTO_SIN_PERMISO } from './errores';

describe('cliente HTTP', () => {
  it('usa el prefijo /api, envía la cookie del mismo sitio y JSON', async () => {
    const { llamadas } = simularApi({
      'POST /acceso/iniciar-sesion': {
        estado: 200,
        cuerpo: {
          id: 'E1',
          nombre: 'Ana',
          correo: 'a@x.co',
          rol: 'ESTUDIANTE',
        },
      },
    });
    await iniciarSesion('a@x.co', 'secreta-de-prueba');
    expect(llamadas).toEqual([
      {
        metodo: 'POST',
        url: '/api/acceso/iniciar-sesion',
        cuerpo: { correo: 'a@x.co', contrasena: 'secreta-de-prueba' },
        credenciales: 'same-origin',
      },
    ]);
  });

  it('401 en una petición protegida avisa al manejador de sesión (ajuste A)', async () => {
    simularApi({ 'GET /consulta/registros': SIN_SESION });
    const manejador = vi.fn();
    registrarSesionInvalida(manejador);
    await expect(
      pedir({ metodo: 'GET', ruta: '/consulta/registros' }),
    ).rejects.toBeInstanceOf(ErrorApi);
    expect(manejador).toHaveBeenCalledWith('Sesión no válida o caducada');
    registrarSesionInvalida(null);
  });

  it('401 de las rutas públicas y de la consulta inicial: sin aviso', async () => {
    simularApi({
      'POST /acceso/iniciar-sesion': {
        estado: 401,
        cuerpo: { message: 'Correo o contraseña incorrectos' },
      },
      'GET /acceso/sesion': SIN_SESION,
    });
    const manejador = vi.fn();
    registrarSesionInvalida(manejador);
    await expect(iniciarSesion('a@x.co', 'mala')).rejects.toThrow(
      'Correo o contraseña incorrectos',
    );
    await expect(consultarSesion()).resolves.toBeNull();
    expect(manejador).not.toHaveBeenCalled();
    registrarSesionInvalida(null);
  });

  it('sin conexión: ErrorApi sin código y el texto de error de red', async () => {
    simularApi({ 'GET /acceso/sesion': 'red' });
    const error = await consultarSesion().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).estado).toBeNull();
    expect((error as ErrorApi).message).toBe(TEXTO_ERROR_RED);
  });
});

/*
 * Descarga de un archivo (F3, CUD10 paso 6: exportar el informe en PDF). El
 * nombre no se toma de Content-Disposition: entre orígenes el CORS del
 * backend no expone esa cabecera (ajuste C de F3).
 */
describe('descargar', () => {
  it('devuelve el contenido como Blob, por GET y con la cookie del mismo sitio', async () => {
    const falso = vi.fn(
      async () =>
        new Response('%PDF-1.4', {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' },
        }),
    );
    vi.stubGlobal('fetch', falso);
    const archivo = await descargar('/informes/I1/pdf');
    expect(await archivo.text()).toBe('%PDF-1.4');
    expect(falso).toHaveBeenCalledWith(
      '/api/informes/I1/pdf',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('un fallo da el error uniforme y el 401 avisa a la sesión', async () => {
    simularApi({
      'GET /informes/I1/pdf': { estado: 403, cuerpo: { message: 'Forbidden' } },
      'GET /informes/I2/pdf': SIN_SESION,
    });
    await expect(descargar('/informes/I1/pdf')).rejects.toThrow(
      TEXTO_SIN_PERMISO,
    );
    const manejador = vi.fn();
    registrarSesionInvalida(manejador);
    await expect(descargar('/informes/I2/pdf')).rejects.toBeInstanceOf(
      ErrorApi,
    );
    expect(manejador).toHaveBeenCalledWith('Sesión no válida o caducada');
    registrarSesionInvalida(null);
  });
});
