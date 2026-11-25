import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MARCA_PESTANA } from '../componentes/sesion';
import { pedir } from '../servicios-api/cliente';
import type { Rol } from '../servicios-api/tipos';
import {
  comprobarSoloMarca,
  renderizar,
  SIN_SESION,
  sesionDe,
  simularApi,
  simularCanal,
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
      'POST /acceso/iniciar-sesion': {
        estado: 200,
        cuerpo: sesionDe('ESTUDIANTE'),
      },
      'POST /acceso/cerrar-sesion': { estado: 204 },
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

const metodosYRutas = (llamadas: { metodo: string; url: string }[]) =>
  llamadas.map((l) => `${l.metodo} ${l.url}`);

/*
 * Decisión (g), revisada: en una pestaña nueva siempre se piden correo y
 * contraseña, pero sin cerrar la sesión de las demás pestañas. La marca de
 * pestaña distingue la recarga (F5) de una pestaña nueva.
 */
describe('Acceso por pestaña (decisión (g))', () => {
  it('con marca y cookie vigente: restaura la sesión con una sola consulta', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('DOCENTE') },
    });
    renderizar('/docente/inicio');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' });
    expect(metodosYRutas(llamadas)).toEqual(['GET /api/acceso/sesion']);
  });

  it('sin marca y cookie vigente: muestra el inicio de sesión sin consultar ni cerrar la sesión', async () => {
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
    expect(llamadas).toEqual([]);
  });

  it('recarga en la misma pestaña: tras iniciar sesión, volver a montar restaura la sesión', async () => {
    simularApi({
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
});

describe('Acceso por pestaña (decisión (g)): marca y sesión que termina', () => {
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
    });
    renderizar('/psicologo', { marcar: false });
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(llamadas).toEqual([]);
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
});

const DOCENTE: RespuestaSimulada = {
  estado: 200,
  cuerpo: sesionDe('DOCENTE'),
};

/** La cookie es del Docente en la primera consulta y, tras el aviso, `despues`. */
function cookieQueCambia(despues: RespuestaSimulada | 'red') {
  let consultas = 0;
  return () => {
    consultas += 1;
    return consultas === 1 ? DOCENTE : despues;
  };
}

/** Pestaña del Docente que recibe el aviso de otra pestaña y lo consulta. */
async function pestanaDeDocenteAvisada(despues: RespuestaSimulada | 'red') {
  const canal = simularCanal();
  const { llamadas } = simularApi({
    'GET /acceso/sesion': cookieQueCambia(despues),
  });
  renderizar('/docente/inicio');
  await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' });
  await waitFor(() => expect(canal.escuchando()).toBe(true));
  await act(async () => canal.emitir());
  await waitFor(() =>
    expect(metodosYRutas(llamadas)).toEqual([
      'GET /api/acceso/sesion',
      'GET /api/acceso/sesion',
    ]),
  );
  return canal;
}

/*
 * Decisión (g), revisada: al iniciar sesión, la pestaña lo avisa a las
 * demás por BroadcastChannel, sin datos. La que tiene sesión consulta
 * GET /acceso/sesion y, si la cookie ya es de otro usuario o no hay sesión
 * (401), vuelve al inicio de sesión con el aviso de sesión caducada.
 */
describe('Aviso entre pestañas (decisión (g), revisada): la pestaña que recibe', () => {
  it('otro usuario en otra pestaña: inicio de sesión con el aviso, sin marca, sin cerrar la cookie y sin reenviar el aviso', async () => {
    const canal = await pestanaDeDocenteAvisada({
      estado: 200,
      cuerpo: sesionDe('ESTUDIANTE'),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
    expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion');
    expect(sessionStorage.getItem(MARCA_PESTANA)).toBeNull();
    expect(canal.publicados).toEqual([]);
  });

  it('el mismo usuario en otra pestaña: sigue en su pantalla, con la marca, sin aviso y sin reenviarlo', async () => {
    const canal = await pestanaDeDocenteAvisada(DOCENTE);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hola, Usuario' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sessionStorage.getItem(MARCA_PESTANA)).not.toBeNull();
    expect(canal.publicados).toEqual([]);
  });

  it('la consulta del aviso responde 401: se trata como otro usuario', async () => {
    await pestanaDeDocenteAvisada(SIN_SESION);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
    expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion');
  });

  it('la consulta del aviso falla con 5xx: no hace nada', async () => {
    await pestanaDeDocenteAvisada({
      estado: 503,
      cuerpo: { message: 'No disponible' },
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hola, Usuario' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sessionStorage.getItem(MARCA_PESTANA)).not.toBeNull();
  });

  it('la consulta del aviso falla por la red: no hace nada', async () => {
    await pestanaDeDocenteAvisada('red');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hola, Usuario' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Aviso entre pestañas (decisión (g), revisada): la pestaña que avisa y el canal', () => {
  it('iniciar sesión avisa una sola vez, sin datos del usuario', async () => {
    const canal = simularCanal();
    simularApi({
      'POST /acceso/iniciar-sesion': {
        estado: 200,
        cuerpo: sesionDe('DOCENTE'),
      },
    });
    renderizar('/', { marcar: false });
    await iniciarComo('d@ejemplo.edu.co', 'clave-12345678');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' });
    expect(canal.publicados).toEqual(['sesion-iniciada']);
  });

  it('una pestaña sin sesión ignora el aviso y no consulta la API', async () => {
    const canal = simularCanal();
    const { llamadas } = simularApi({});
    renderizar('/', { marcar: false });
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(canal.escuchando()).toBe(false);
    await act(async () => canal.emitir());
    expect(llamadas).toEqual([]);
  });

  it('un solo canal por proveedor de sesión, cerrado al desmontar', async () => {
    const canal = simularCanal();
    simularApi({ 'GET /acceso/sesion': DOCENTE });
    const vista = renderizar('/docente/inicio');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' });
    expect(canal.abiertos()).toBe(1);
    vista.unmount();
    expect(canal.abiertos()).toBe(0);
  });

  it('sin BroadcastChannel en el navegador: iniciar sesión funciona sin errores', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    simularApi({
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
});
