import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DETALLE_ALERTA, ID_CASO_SECRETO } from './datos-jefe';
import { renderizar, sesionDe, simularApi } from './utilidades';

/*
 * Plantilla común con barra lateral (especificación de diseño, §3.1 a 3.4):
 * marca, rol, un solo menú con íconos, usuario con iniciales y «Cerrar
 * sesión»; el enlace de regreso va encima del título.
 */

describe('Plantilla de los roles (F5b-diseño, D2)', () => {
  it('marca, rol, usuario con iniciales y «Cerrar sesión» con ícono', async () => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('ESTUDIANTE') },
    });
    renderizar('/estudiante');
    await screen.findByRole('heading', { level: 1 });
    const barra = within(screen.getByRole('banner'));
    expect(
      barra.getByRole('img', { name: 'Logo de DETECTA' }),
    ).toBeInTheDocument();
    expect(barra.getByText('DETECTA')).toBeInTheDocument();
    expect(barra.getAllByText('Estudiante').length).toBeGreaterThan(0);
    expect(barra.getByText('Usuario ESTUDIANTE')).toBeInTheDocument();
    const avatar = barra.getByText('UE');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    const cerrar = barra.getByRole('button', { name: 'Cerrar sesión' });
    expect(cerrar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('un solo menú; cada enlace con ícono decorativo y el activo marcado', async () => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('ESTUDIANTE') },
    });
    renderizar('/estudiante');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const enlaces = within(screen.getByRole('navigation')).getAllByRole('link');
    // «Inicio» y las tres funciones del Estudiante (D4a, §7.0).
    expect(enlaces).toHaveLength(4);
    for (const enlace of enlaces) {
      expect(enlace.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }
    expect(
      within(screen.getByRole('navigation')).getByRole('link', {
        name: 'Consulta académica',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('el rol largo del Jefe aparece completo', async () => {
    simularApi({
      'GET /acceso/sesion': {
        estado: 200,
        cuerpo: sesionDe('JEFE_DEPARTAMENTO'),
      },
      'GET /casos/pendientes': { estado: 200, cuerpo: [] },
    });
    renderizar('/jefe-departamento');
    await screen.findByText('No hay casos pendientes');
    expect(
      within(screen.getByRole('banner')).getAllByText(
        'Jefe de Departamento de Programa',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('el enlace de regreso va encima del título de la pantalla', async () => {
    simularApi({
      'GET /acceso/sesion': {
        estado: 200,
        cuerpo: sesionDe('JEFE_DEPARTAMENTO'),
      },
      [`GET /casos/${ID_CASO_SECRETO}`]: {
        estado: 200,
        cuerpo: DETALLE_ALERTA,
      },
    });
    renderizar(`/jefe-departamento/casos/${ID_CASO_SECRETO}`);
    const volver = await screen.findByRole('link', {
      name: 'Volver a casos pendientes',
    });
    const titulo = screen.getByRole('heading', { level: 1 });
    expect(
      volver.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
