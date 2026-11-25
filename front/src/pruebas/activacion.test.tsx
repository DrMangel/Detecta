import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderizar, SIN_SESION, simularApi } from './utilidades';

/*
 * Enlace de activación (D6; nota para F0; ajuste C): el token se lee del
 * fragmento, se borra de la URL de inmediato, se envía en el cuerpo y no se
 * guarda en el navegador.
 */

const TOKEN = 'TokenDePrueba_abcdefghijklmnopqrstuvwxyz0123456';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('Fijar contraseña con el enlace de activación', () => {
  it('lee el token del fragmento, lo borra de la URL, lo envía en el cuerpo y lleva al inicio de sesión', async () => {
    const escritura = vi.spyOn(Storage.prototype, 'setItem');
    const reemplazo = vi.spyOn(window.history, 'replaceState');
    window.history.replaceState(null, '', `/activar#token=${TOKEN}`);
    reemplazo.mockClear();
    const { llamadas } = simularApi({
      'POST /acceso/cerrar-sesion': { estado: 204 },
      'POST /acceso/activar': { estado: 204 },
    });

    // El enlace llega por correo y se abre en una pestaña nueva, sin marca (decisión (g)).
    renderizar('/activar', { marcar: false });
    expect(
      await screen.findByRole('heading', { name: 'Fijar contraseña' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Fijar contraseña · DETECTA'),
    );
    // Borrado de inmediato, antes de cualquier acción del usuario.
    expect(reemplazo).toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(TOKEN);

    const usuario = userEvent.setup();
    await usuario.type(
      screen.getByLabelText('Nueva contraseña'),
      'una-contrasena-larga',
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Fijar contraseña' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion'),
    );
    const activar = llamadas.find((l) => l.url === '/api/acceso/activar');
    expect(activar?.cuerpo).toEqual({
      token: TOKEN,
      contrasena: 'una-contrasena-larga',
    });
    expect(activar?.url).not.toContain(TOKEN);
    expect(escritura).not.toHaveBeenCalled();
    // Sin campo de confirmación (respuesta 4 del plan de F0).
    expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
  });

  it('tras fijar la contraseña, el inicio de sesión muestra UNA vez «Contraseña fijada. Ya puede iniciar sesión.» con role="status"', async () => {
    window.history.replaceState(null, '', `/activar#token=${TOKEN}`);
    simularApi({
      'GET /acceso/sesion': SIN_SESION,
      'POST /acceso/activar': { estado: 204 },
    });
    renderizar('/activar');
    const usuario = userEvent.setup();
    await usuario.type(
      await screen.findByLabelText('Nueva contraseña'),
      'una-contrasena-larga',
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Fijar contraseña' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Contraseña fijada. Ya puede iniciar sesión.',
    );
    expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion');
    expect(screen.queryByRole('alert')).toBeNull();

    // Una sola vez: al ir y volver, la confirmación ya no aparece.
    await usuario.click(
      screen.getByRole('link', { name: 'Solicitar enlace de acceso' }),
    );
    await usuario.click(screen.getByRole('link', { name: 'Iniciar sesión' }));
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sin token en el enlace: el texto del backend y el botón deshabilitado', async () => {
    simularApi({ 'GET /acceso/sesion': SIN_SESION });
    renderizar('/activar');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El enlace no es válido o ya caducó',
    );
    expect(
      screen.getByRole('button', { name: 'Fijar contraseña' }),
    ).toBeDisabled();
  });

  it('enlace vencido (400 del backend): su texto, sin salir de la pantalla', async () => {
    window.history.replaceState(null, '', `/activar#token=${TOKEN}`);
    simularApi({
      'GET /acceso/sesion': SIN_SESION,
      'POST /acceso/activar': {
        estado: 400,
        cuerpo: { message: 'El enlace no es válido o ya caducó' },
      },
    });
    renderizar('/activar');
    const usuario = userEvent.setup();
    await usuario.type(
      await screen.findByLabelText('Nueva contraseña'),
      'una-contrasena-larga',
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Fijar contraseña' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El enlace no es válido o ya caducó',
    );
    expect(screen.getByTestId('ruta')).toHaveTextContent('/activar');
  });

  it('la pantalla de solicitar enlace sirve para activar y recuperar (D6): un solo correo y «Solicitar enlace»', async () => {
    simularApi({ 'GET /acceso/sesion': SIN_SESION });
    renderizar('/solicitar-activacion');
    expect(
      await screen.findByRole('heading', {
        name: 'Solicitar enlace de acceso',
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Solicitar enlace de acceso · DETECTA'),
    );
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
  });
});
