import { describe, expect, it, vi } from 'vitest';
import { SIN_SESION, simularApi } from '../pruebas/utilidades';
import { consultarSesion, iniciarSesion } from './acceso';
import { pedir, registrarSesionInvalida } from './cliente';
import { ErrorApi, TEXTO_ERROR_RED } from './errores';

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
