import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderizar, SIN_SESION, simularApi } from './utilidades';

/*
 * Pantallas de acceso (especificación de diseño §7.1): logo completo, título
 * y formulario en tarjeta; ayuda solo en el inicio de sesión.
 */

describe('Pantallas de acceso (F5b-diseño, D4a)', () => {
  it('iniciar sesión: logo, título, ayuda, campos y «Solicitar enlace de acceso»', async () => {
    simularApi({ 'GET /acceso/sesion': SIN_SESION });
    renderizar('/iniciar-sesion');
    const principal = within(await screen.findByRole('main'));
    expect(
      principal.getByRole('img', { name: 'Logo de DETECTA' }),
    ).toBeInTheDocument();
    expect(
      principal.getByRole('heading', { level: 1, name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(
      principal.getByText('Ingresa con tu correo institucional.'),
    ).toBeInTheDocument();
    expect(principal.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(principal.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(
      principal.getByRole('link', { name: 'Solicitar enlace de acceso' }),
    ).toHaveAttribute('href', '/solicitar-activacion');
  });

  it('solicitar enlace y fijar contraseña: el mismo logo, sin la ayuda del inicio de sesión', async () => {
    simularApi({ 'GET /acceso/sesion': SIN_SESION });
    const { unmount } = renderizar('/solicitar-activacion');
    expect(
      await screen.findByRole('img', { name: 'Logo de DETECTA' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Ingresa con tu correo institucional.'),
    ).toBeNull();
    unmount();
    renderizar('/activar');
    expect(
      await screen.findByRole('img', { name: 'Logo de DETECTA' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Ingresa con tu correo institucional.'),
    ).toBeNull();
  });
});
