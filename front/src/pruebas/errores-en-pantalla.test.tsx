import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TEXTO_ERROR_GENERICO,
  TEXTO_ERROR_RED,
  TEXTO_SIN_PERMISO,
} from '../servicios-api/errores';
import {
  renderizar,
  SIN_SESION,
  simularApi,
  type RespuestaSimulada,
} from './utilidades';

/*
 * Criterio de cierre de F0: los errores 401, 403, 409, 429 (con
 * Retry-After), 503 y 500, y el error de red, se muestran de forma uniforme:
 * el mismo componente (role="alert") con el texto que corresponde.
 */

async function enviarSolicitud() {
  const usuario = userEvent.setup();
  await usuario.type(
    await screen.findByLabelText('Correo electrónico'),
    'a@ejemplo.edu.co',
  );
  await usuario.click(screen.getByRole('button', { name: 'Solicitar enlace' }));
  return usuario;
}

describe('Errores uniformes en pantalla', () => {
  it.each<[string, RespuestaSimulada | 'red', string]>([
    [
      '403',
      { estado: 403, cuerpo: { message: 'Forbidden' } },
      TEXTO_SIN_PERMISO,
    ],
    [
      '409',
      {
        estado: 409,
        cuerpo: {
          message: 'Ya hay una sincronización en curso; intente más tarde.',
        },
      },
      'Ya hay una sincronización en curso; intente más tarde.',
    ],
    [
      '503 con texto de la ruta',
      { estado: 503, cuerpo: { message: 'Error al consultar la información' } },
      'Error al consultar la información',
    ],
    ['503 sin texto', { estado: 503 }, TEXTO_ERROR_GENERICO],
    [
      '500',
      {
        estado: 500,
        cuerpo: { statusCode: 500, message: 'Internal server error' },
      },
      TEXTO_ERROR_GENERICO,
    ],
    ['error de red', 'red', TEXTO_ERROR_RED],
  ])(
    '%s: role="alert" con el texto uniforme',
    async (_caso, respuesta, texto) => {
      simularApi({
        'GET /acceso/sesion': SIN_SESION,
        'POST /acceso/solicitar-activacion': respuesta,
      });
      renderizar('/solicitar-activacion');
      await enviarSolicitud();
      expect(await screen.findByRole('alert')).toHaveTextContent(texto);
      expect(screen.getAllByRole('alert')).toHaveLength(1);
    },
  );

  it('401 en el inicio de sesión: el texto del backend en el mismo componente', async () => {
    simularApi({
      'GET /acceso/sesion': SIN_SESION,
      'POST /acceso/iniciar-sesion': {
        estado: 401,
        cuerpo: { message: 'Correo o contraseña incorrectos' },
      },
    });
    renderizar('/iniciar-sesion');
    const usuario = userEvent.setup();
    await usuario.type(
      await screen.findByLabelText('Correo electrónico'),
      'a@ejemplo.edu.co',
    );
    await usuario.type(screen.getByLabelText('Contraseña'), 'mala');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Correo o contraseña incorrectos',
    );
  });

  it('202 de solicitar-activacion: el mensaje del backend como estado, no como error', async () => {
    simularApi({
      'GET /acceso/sesion': SIN_SESION,
      'POST /acceso/solicitar-activacion': {
        estado: 202,
        cuerpo: {
          mensaje:
            'Si el correo está registrado, recibirá un enlace para fijar su contraseña.',
        },
      },
    });
    renderizar('/solicitar-activacion');
    await enviarSolicitud();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si el correo está registrado, recibirá un enlace para fijar su contraseña.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('429 con Retry-After (D15)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['/iniciar-sesion', 'POST /acceso/iniciar-sesion', 'Iniciar sesión'],
    [
      '/solicitar-activacion',
      'POST /acceso/solicitar-activacion',
      'Solicitar enlace',
    ],
  ])(
    '%s: texto del backend y botón deshabilitado hasta que vence Retry-After',
    async (ruta, clave, boton) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      simularApi({
        'GET /acceso/sesion': SIN_SESION,
        [clave]: {
          estado: 429,
          cuerpo: {
            message: 'Demasiados intentos. Intente de nuevo más tarde.',
          },
          cabeceras: { 'Retry-After': '30' },
        },
      });
      renderizar(ruta);
      const usuario = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });
      await usuario.type(
        await screen.findByLabelText('Correo electrónico'),
        'a@ejemplo.edu.co',
      );
      if (ruta === '/iniciar-sesion') {
        await usuario.type(screen.getByLabelText('Contraseña'), 'x');
      }
      await usuario.click(screen.getByRole('button', { name: boton }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Demasiados intentos. Intente de nuevo más tarde.',
      );
      expect(screen.getByRole('button', { name: boton })).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(29_000);
      });
      expect(screen.getByRole('button', { name: boton })).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(1_500);
      });
      expect(screen.getByRole('button', { name: boton })).toBeEnabled();
    },
  );
});
