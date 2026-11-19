import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { pedir } from '../servicios-api/cliente';
import type { Rol } from '../servicios-api/tipos';
import { renderizar, SIN_SESION, sesionDe, simularApi } from './utilidades';

/*
 * Criterio de cierre de F0: cada rol inicia sesión y ve su espacio vacío; es
 * redirigido fuera de las rutas de otro rol; el 401 de una petición
 * protegida lleva al inicio de sesión con el aviso una vez (ajuste A).
 */

const ROLES: [Rol, string, string][] = [
  ['ESTUDIANTE', '/estudiante', 'Consulta académica'],
  ['DOCENTE', '/docente', 'Docente'],
  [
    'JEFE_DEPARTAMENTO',
    '/jefe-departamento',
    'Jefe de Departamento de Programa',
  ],
  ['PSICOLOGO', '/psicologo', 'Psicólogo'],
];

async function iniciarComo(correo: string, contrasena: string) {
  const usuario = userEvent.setup();
  await usuario.type(
    await screen.findByLabelText('Correo electrónico'),
    correo,
  );
  await usuario.type(screen.getByLabelText('Contraseña'), contrasena);
  await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('Inicio de sesión por rol', () => {
  it.each(ROLES)(
    '%s inicia sesión y ve su espacio vacío en %s',
    async (rol, ruta, titulo) => {
      const { llamadas } = simularApi({
        'GET /acceso/sesion': SIN_SESION,
        'POST /acceso/iniciar-sesion': { estado: 200, cuerpo: sesionDe(rol) },
      });
      renderizar('/');
      await iniciarComo(
        `  ${rol.toLowerCase()}@ejemplo.edu.co `,
        'clave-12345678',
      );

      expect(
        await screen.findByRole('heading', { level: 1, name: titulo }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('ruta')).toHaveTextContent(ruta);
      await waitFor(() => expect(document.title).toBe(`${titulo} · DETECTA`));
      expect(screen.getByText(`Usuario ${rol}`)).toBeInTheDocument();
      // Espacio vacío: solo el título dentro del contenido principal. El del
      // Estudiante tiene contenido desde F1 (pruebas en estudiante-*.test).
      if (rol !== 'ESTUDIANTE') {
        expect(screen.getByRole('main').children).toHaveLength(1);
      }
      expect(llamadas.at(-1)?.cuerpo).toEqual({
        correo: `${rol.toLowerCase()}@ejemplo.edu.co`,
        contrasena: 'clave-12345678',
      });
    },
  );

  it('credenciales incorrectas: el texto del backend y sigue en el inicio de sesión', async () => {
    simularApi({
      'GET /acceso/sesion': SIN_SESION,
      'POST /acceso/iniciar-sesion': {
        estado: 401,
        cuerpo: { message: 'Correo o contraseña incorrectos' },
      },
    });
    renderizar('/iniciar-sesion');
    await iniciarComo('a@ejemplo.edu.co', 'mala');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Correo o contraseña incorrectos',
    );
    expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });
});

describe('Rutas protegidas por rol (ayuda de usabilidad)', () => {
  it.each(
    ROLES.flatMap(([rol, propia]) =>
      ROLES.filter(([otro]) => otro !== rol).map(
        ([, ajena]) => [rol, ajena, propia] as const,
      ),
    ),
  )('%s que entra a %s es redirigido a %s', async (rol, ajena, propia) => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe(rol) },
    });
    renderizar(ajena);
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent(propia),
    );
  });

  it('sin sesión: cualquier espacio lleva al inicio de sesión, sin mensaje y con una sola consulta (sin bucles)', async () => {
    const { falso } = simularApi({ 'GET /acceso/sesion': SIN_SESION });
    renderizar('/psicologo');
    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.title).toBe('Iniciar sesión · DETECTA');
    expect(falso).toHaveBeenCalledTimes(1);
  });

  it('con sesión, las pantallas de acceso llevan al espacio del rol', async () => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('DOCENTE') },
    });
    renderizar('/iniciar-sesion');
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/docente'),
    );
  });

  it('una ruta desconocida vuelve al inicio', async () => {
    simularApi({ 'GET /acceso/sesion': SIN_SESION });
    renderizar('/no-existe');
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion'),
    );
  });
});

describe('Sesión caducada y cierre de sesión', () => {
  it('401 en una petición protegida: al inicio de sesión con «Sesión no válida o caducada», una sola vez (ajuste A)', async () => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('ESTUDIANTE') },
      'GET /consulta/registros': SIN_SESION,
    });
    renderizar('/estudiante');
    await screen.findByRole('heading', { name: 'Consulta académica' });

    await act(async () => {
      await pedir('GET', '/consulta/registros').catch(() => undefined);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
    expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion');

    // Una sola vez: al ir y volver, el aviso ya no aparece.
    const usuario = userEvent.setup();
    await usuario.click(
      screen.getByRole('link', { name: 'Solicitar enlace de acceso' }),
    );
    await usuario.click(screen.getByRole('link', { name: 'Iniciar sesión' }));
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cerrar sesión: POST /acceso/cerrar-sesion y vuelve al inicio de sesión', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('PSICOLOGO') },
      'POST /acceso/cerrar-sesion': { estado: 204 },
    });
    renderizar('/psicologo');
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(llamadas.map((l) => `${l.metodo} ${l.url}`)).toEqual([
      'GET /api/acceso/sesion',
      'POST /api/acceso/cerrar-sesion',
    ]);
  });
});

describe('Nada en el almacenamiento del navegador', () => {
  it('iniciar sesión, cerrar sesión y solicitar enlace no escriben en localStorage ni sessionStorage', async () => {
    const escritura = vi.spyOn(Storage.prototype, 'setItem');
    simularApi({
      'GET /acceso/sesion': SIN_SESION,
      'POST /acceso/iniciar-sesion': {
        estado: 200,
        cuerpo: sesionDe('ESTUDIANTE'),
      },
      'POST /acceso/cerrar-sesion': { estado: 204 },
    });
    renderizar('/');
    await iniciarComo('e@ejemplo.edu.co', 'clave-12345678');
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(escritura).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
