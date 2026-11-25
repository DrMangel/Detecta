import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LIMITE_CIERRE_MS, MARCA_PESTANA } from '../componentes/sesion';
import { pedir } from '../servicios-api/cliente';
import type { Rol } from '../servicios-api/tipos';
import {
  comprobarSoloMarca,
  renderizar,
  SIN_SESION,
  sesionDe,
  simularApi,
  type RespuestaSimulada,
} from './utilidades';

/*
 * Criterio de cierre de F0: cada rol inicia sesión y ve su espacio vacío; es
 * redirigido fuera de las rutas de otro rol; el 401 de una petición
 * protegida lleva al inicio de sesión con el aviso una vez (ajuste A).
 */

/* Tras iniciar sesión, cada rol llega a su inicio (F5b-diseño, §7.0). */
const ROLES: [Rol, string][] = [
  ['ESTUDIANTE', '/estudiante/inicio'],
  ['DOCENTE', '/docente/inicio'],
  ['JEFE_DEPARTAMENTO', '/jefe-departamento/inicio'],
  ['PSICOLOGO', '/psicologo/inicio'],
];

async function iniciarComo(
  correo: string,
  contrasena: string,
  opciones?: Parameters<typeof userEvent.setup>[0],
) {
  const usuario = userEvent.setup(opciones);
  await usuario.type(
    await screen.findByLabelText('Correo electrónico'),
    correo,
  );
  await usuario.type(screen.getByLabelText('Contraseña'), contrasena);
  await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('Inicio de sesión por rol', () => {
  it.each(ROLES)(
    '%s inicia sesión y llega a su inicio en %s',
    async (rol, ruta) => {
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
        await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('ruta')).toHaveTextContent(ruta);
      await waitFor(() => expect(document.title).toBe('Inicio · DETECTA'));
      expect(screen.getByText(`Usuario ${rol}`)).toBeInTheDocument();
      const inicio = llamadas.find((l) => l.url.endsWith('/iniciar-sesion'));
      expect(inicio?.cuerpo).toEqual({
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
    await waitFor(() =>
      expect(document.title).toBe('Iniciar sesión · DETECTA'),
    );
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
      await pedir({ metodo: 'GET', ruta: '/consulta/registros' }).catch(
        () => undefined,
      );
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
      'GET /atencion/casos': { estado: 200, cuerpo: [] },
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
      'GET /api/atencion/casos',
      'POST /api/acceso/cerrar-sesion',
    ]);
  });
});

describe('Almacenamiento del navegador: solo la marca de pestaña (decisión (g))', () => {
  it('iniciar sesión deja solo la marca, sin token ni correo, y cerrar sesión la borra', async () => {
    const escritura = vi.spyOn(Storage.prototype, 'setItem');
    simularApi({
      'POST /acceso/cerrar-sesion': { estado: 204 },
      'POST /acceso/iniciar-sesion': {
        estado: 200,
        cuerpo: sesionDe('ESTUDIANTE'),
      },
    });
    renderizar('/', { marcar: false });
    await iniciarComo('e@ejemplo.edu.co', 'clave-12345678');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' });
    comprobarSoloMarca(escritura);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });
});

/*
 * Decisión (g): en una pestaña nueva siempre se piden correo y contraseña,
 * aunque la cookie siga vigente. La marca de pestaña distingue la recarga
 * (F5) de una pestaña nueva.
 */
describe('Acceso por pestaña (decisión (g))', () => {
  const CERRAR = 'POST /api/acceso/cerrar-sesion';
  const metodosYRutas = (llamadas: { metodo: string; url: string }[]) =>
    llamadas.map((l) => `${l.metodo} ${l.url}`);

  it('con marca y cookie vigente: restaura la sesión con una sola consulta', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('DOCENTE') },
    });
    renderizar('/docente/inicio');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' });
    expect(metodosYRutas(llamadas)).toEqual(['GET /api/acceso/sesion']);
  });

  it('sin marca y cookie vigente: muestra el inicio de sesión, cierra la sesión y no la consulta', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('PSICOLOGO') },
      'POST /acceso/cerrar-sesion': { estado: 204 },
    });
    renderizar('/psicologo', { marcar: false });
    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion');
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(metodosYRutas(llamadas)).toEqual([CERRAR]));
  });

  it('recarga en la misma pestaña: tras iniciar sesión, volver a montar restaura la sesión', async () => {
    simularApi({
      'POST /acceso/cerrar-sesion': { estado: 204 },
      'POST /acceso/iniciar-sesion': {
        estado: 200,
        cuerpo: sesionDe('JEFE_DEPARTAMENTO'),
      },
    });
    const primera = renderizar('/', { marcar: false });
    await iniciarComo('j@ejemplo.edu.co', 'clave-12345678');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' });
    primera.unmount();

    const { llamadas } = simularApi({
      'GET /acceso/sesion': {
        estado: 200,
        cuerpo: sesionDe('JEFE_DEPARTAMENTO'),
      },
    });
    renderizar('/jefe-departamento/inicio', { marcar: false });
    await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' });
    expect(metodosYRutas(llamadas)).toEqual(['GET /api/acceso/sesion']);
  });

  it('cerrar sesión borra la marca: al volver a montar se piden de nuevo las credenciales', async () => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('PSICOLOGO') },
      'GET /atencion/casos': { estado: 200, cuerpo: [] },
      'POST /acceso/cerrar-sesion': { estado: 204 },
    });
    const primera = renderizar('/psicologo');
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(sessionStorage.getItem(MARCA_PESTANA)).toBeNull();
    primera.unmount();

    const { llamadas } = simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('PSICOLOGO') },
      'POST /acceso/cerrar-sesion': { estado: 204 },
    });
    renderizar('/psicologo', { marcar: false });
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await waitFor(() => expect(metodosYRutas(llamadas)).toEqual([CERRAR]));
  });

  it('401 en una petición protegida: borra la marca', async () => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('ESTUDIANTE') },
      'GET /consulta/registros': SIN_SESION,
    });
    renderizar('/estudiante');
    await screen.findByRole('heading', { name: 'Consulta académica' });
    await act(async () => {
      await pedir({ metodo: 'GET', ruta: '/consulta/registros' }).catch(
        () => undefined,
      );
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
    expect(sessionStorage.getItem(MARCA_PESTANA)).toBeNull();
  });

  it('con marca y cookie caducada: inicio de sesión sin aviso y sin marca', async () => {
    simularApi({ 'GET /acceso/sesion': SIN_SESION });
    renderizar('/estudiante');
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sessionStorage.getItem(MARCA_PESTANA)).toBeNull();
  });

  it('sessionStorage bloqueado: el inicio de sesión funciona sin errores en pantalla', async () => {
    const bloqueado = () => {
      throw new DOMException('Bloqueado', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bloqueado);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bloqueado);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(bloqueado);
    simularApi({
      'POST /acceso/cerrar-sesion': { estado: 204 },
      'POST /acceso/iniciar-sesion': {
        estado: 200,
        cuerpo: sesionDe('DOCENTE'),
      },
    });
    renderizar('/', { marcar: false });
    await iniciarComo('d@ejemplo.edu.co', 'clave-12345678');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ajuste A: con un cierre lento, el inicio de sesión se muestra de inmediato y el envío espera al cierre', async () => {
    let terminarCierre: (respuesta: RespuestaSimulada) => void = () =>
      undefined;
    const { llamadas } = simularApi({
      'POST /acceso/cerrar-sesion': () =>
        new Promise<RespuestaSimulada>((resolver) => {
          terminarCierre = resolver;
        }),
      'POST /acceso/iniciar-sesion': {
        estado: 200,
        cuerpo: sesionDe('ESTUDIANTE'),
      },
    });
    renderizar('/', { marcar: false });
    await iniciarComo('e@ejemplo.edu.co', 'clave-12345678');
    expect(metodosYRutas(llamadas)).toEqual([CERRAR]);
    expect(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    ).toBeDisabled();

    await act(async () => terminarCierre({ estado: 204 }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' }),
    ).toBeInTheDocument();
    expect(metodosYRutas(llamadas)).toEqual([
      CERRAR,
      'POST /api/acceso/iniciar-sesion',
    ]);
    comprobarSoloMarca();
  });

  it('ajuste A: si el cierre no responde, el envío sigue al vencer el tiempo máximo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { llamadas } = simularApi({
        'POST /acceso/cerrar-sesion': () => new Promise<never>(() => undefined),
        'POST /acceso/iniciar-sesion': {
          estado: 200,
          cuerpo: sesionDe('DOCENTE'),
        },
      });
      renderizar('/', { marcar: false });
      await iniciarComo('d@ejemplo.edu.co', 'clave-12345678', {
        advanceTimers: vi.advanceTimersByTime,
      });
      expect(metodosYRutas(llamadas)).toEqual([CERRAR]);

      await act(async () => vi.advanceTimersByTimeAsync(LIMITE_CIERRE_MS));
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
