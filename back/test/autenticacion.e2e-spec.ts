import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import {
  PROVEEDOR_CORREO,
  type ProveedorCorreo,
} from '../src/aplicacion/contratos/proveedor-correo';
import {
  HASH_SIN_ACTIVAR,
  hashContrasenas,
} from '../src/aplicacion/servicios/hash-contrasenas';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import { ModuloAcceso } from '../src/controladores/modulo-acceso';
import { Psicologo } from '../src/dominio/entidades/psicologo';
import { RutaAtencion } from '../src/dominio/entidades/ruta-atencion';
import { validarEntorno } from '../src/validacion-entorno';
import { ControladorPrueba } from './e2e/controlador-prueba';
import {
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
} from './integracion/escenario';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './integracion/soporte';

/*
 * Autenticación y control de acceso de punta a punta (criterio de cierre de
 * B3: "un usuario de cada rol inicia sesión y es rechazado fuera de su
 * rol"). HTTP real contra detecta_pruebas (respuesta 13 de Ivan), con un
 * doble de ProveedorCorreo que captura los mensajes.
 */

const CONTRASENA = 'Contraseña-de-prueba-1';
const URL_FRONTEND = 'http://localhost:5173';
const COOKIE = 'detecta_sesion';

/** Doble de ProveedorCorreo: guarda los correos en memoria. */
class ProveedorCorreoEnMemoria implements ProveedorCorreo {
  readonly enviados: { destino: string; cuerpoHtml: string }[] = [];
  enviar(
    destino: string,
    _asunto: string,
    cuerpoHtml: string,
  ): Promise<boolean> {
    this.enviados.push({ destino, cuerpoHtml });
    return Promise.resolve(true);
  }
}

interface Servidor {
  app: INestApplication;
  url: string;
  correo: ProveedorCorreoEnMemoria;
}

async function levantar(cookieSegura: boolean): Promise<Servidor> {
  const configuracion = new ConfigService(
    validarEntorno({
      ...process.env,
      BD_DETECTA_NOMBRE: BASE_PRUEBAS,
      COOKIE_SEGURA: String(cookieSegura),
      URL_FRONTEND,
    }),
  );
  const correo = new ProveedorCorreoEnMemoria();
  const modulo = await Test.createTestingModule({
    imports: [AppModule, ModuloAcceso],
    controllers: [ControladorPrueba],
  })
    .overrideProvider(ConfigService)
    .useValue(configuracion)
    .overrideProvider(PROVEEDOR_CORREO)
    .useValue(correo)
    .compile();
  const app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  return { app, url: await app.getUrl(), correo };
}

let servidor: Servidor;
let fuente: DataSource;
let idCasoConfidencial: string;

async function iniciarSesion(
  correo: string,
  contrasena = CONTRASENA,
  base = servidor.url,
): Promise<Response> {
  return fetch(`${base}/acceso/iniciar-sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  });
}

function cookieDe(respuesta: Response): string {
  const cabecera = respuesta.headers
    .getSetCookie()
    .find((valor) => valor.startsWith(`${COOKIE}=`));
  return (cabecera ?? '').split(';')[0] ?? '';
}

async function sesionDe(correo: string): Promise<string> {
  const respuesta = await iniciarSesion(correo);
  expect(respuesta.status).toBe(200);
  return cookieDe(respuesta);
}

function obtener(ruta: string, cookie?: string): Promise<Response> {
  return fetch(`${servidor.url}${ruta}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  const repos = crearRepositorios(fuente);
  const esc = await crearEscenario(repos);
  await repos.personas.guardar(
    new Psicologo({
      id: 'PS2',
      nombre: 'Psicólogo Dos',
      correo: 'ps2@ejemplo.edu.co',
      contrasenaHash: 'x',
      citas: [],
    }),
  );
  const hash = await hashContrasenas.generar(CONTRASENA, 10);
  await fuente.query(
    `UPDATE persona SET contrasena_hash = $1 WHERE id IN ('E1', 'D1', 'J1', 'PS1', 'PS2')`,
    [hash],
  );
  await fuente.query('UPDATE persona SET contrasena_hash = $1 WHERE id = $2', [
    HASH_SIN_ACTIVAR,
    'E2',
  ]);
  const { caso } = await casoDeSolicitud(
    repos,
    esc.e1,
    RutaAtencion.PSICOLOGICA,
  );
  caso.asignarPsicologo(esc.ps1);
  await repos.casos.guardar(caso);
  idCasoConfidencial = caso.idCaso;

  servidor = await levantar(true);
});

afterAll(async () => {
  await servidor.app.close();
  await fuente.destroy();
});

const USUARIOS = [
  ['ESTUDIANTE', 'e1@ejemplo.edu.co', 'consultarRegistros', 'emitirAlerta'],
  ['DOCENTE', 'd1@ejemplo.edu.co', 'emitirAlerta', 'radicarSolicitud'],
  [
    'JEFE_DEPARTAMENTO',
    'j1@ejemplo.edu.co',
    'listarCasosPendiente',
    'cerrarCaso',
  ],
  ['PSICOLOGO', 'ps1@ejemplo.edu.co', 'cerrarCaso', 'canalizarCaso'],
] as const;

describe('inicio de sesión y cookie', () => {
  it.each(USUARIOS)(
    '%s inicia sesión: 200 con sus datos (sin hash) y cookie HttpOnly, Secure, SameSite=Strict',
    async (rol, correo) => {
      const respuesta = await iniciarSesion(correo);
      expect(respuesta.status).toBe(200);
      const cuerpo = await respuesta.text();
      expect(JSON.parse(cuerpo)).toEqual({
        id: expect.any(String),
        nombre: expect.any(String),
        correo,
        rol,
      });
      expect(cuerpo).not.toContain('$2');
      expect(cuerpo).not.toContain('hash');

      const setCookie = respuesta.headers
        .getSetCookie()
        .find((valor) => valor.startsWith(`${COOKIE}=`));
      expect(setCookie).toBeDefined();
      const atributos = (setCookie ?? '').split('; ');
      expect(atributos).toEqual(
        expect.arrayContaining([
          'Max-Age=3600',
          'Path=/',
          'HttpOnly',
          'Secure',
          'SameSite=Strict',
        ]),
      );
      if (rol === 'PSICOLOGO') {
        console.log(
          `Set-Cookie real: ${setCookie?.replace(/=[^;]+/, '=<jwt>')}`,
        );
      }
    },
  );

  it('con COOKIE_SEGURA=false la cookie no lleva Secure (desarrollo por http)', async () => {
    const otro = await levantar(false);
    try {
      const respuesta = await iniciarSesion(
        'e1@ejemplo.edu.co',
        CONTRASENA,
        otro.url,
      );
      const setCookie = respuesta.headers.getSetCookie().join('\n');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
      expect(setCookie).not.toContain('Secure');
    } finally {
      await otro.app.close();
    }
  });

  it.each([
    ['correo inexistente', 'nadie@ejemplo.edu.co', CONTRASENA],
    ['cuenta sin activar', 'e2@ejemplo.edu.co', CONTRASENA],
    ['contraseña errónea', 'e1@ejemplo.edu.co', 'otra contraseña larga'],
  ])(
    '%s: 401 con el mismo cuerpo y sin cookie',
    async (_caso, correo, contrasena) => {
      const respuesta = await iniciarSesion(correo, contrasena);
      expect(respuesta.status).toBe(401);
      expect((await respuesta.json()).message).toBe(
        'Correo o contraseña incorrectos',
      );
      expect(respuesta.headers.getSetCookie()).toEqual([]);
    },
  );

  it('cerrar-sesion expira la cookie', async () => {
    const respuesta = await fetch(`${servidor.url}/acceso/cerrar-sesion`, {
      method: 'POST',
    });
    expect(respuesta.status).toBe(204);
    const setCookie = respuesta.headers.getSetCookie().join('\n');
    expect(setCookie).toMatch(/detecta_sesion=;/);
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('GET /acceso/sesion y GuardSesion', () => {
  it('sin sesión: 401', async () => {
    expect((await obtener('/acceso/sesion')).status).toBe(401);
    expect((await obtener('/prueba/accion/consultarRegistros')).status).toBe(
      401,
    );
  });

  it('con sesión: 200 con los datos del usuario', async () => {
    const respuesta = await obtener(
      '/acceso/sesion',
      await sesionDe('j1@ejemplo.edu.co'),
    );
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({
      id: 'J1',
      nombre: 'Jefe Uno',
      correo: 'j1@ejemplo.edu.co',
      rol: 'JEFE_DEPARTAMENTO',
    });
  });

  it('token manipulado, firmado con otro secreto, sin firma (alg none) o caducado: 401', async () => {
    const cookie = await sesionDe('e1@ejemplo.edu.co');
    const token = cookie.split('=')[1] ?? '';
    const [cabecera, , firma] = token.split('.');
    const contenidoFalso = Buffer.from(JSON.stringify({ sub: 'PS1' })).toString(
      'base64url',
    );
    const sinFirma = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${contenidoFalso}.`;
    const otroSecreto = await new JwtService({
      secret: 'x'.repeat(40),
    }).signAsync({
      sub: 'PS1',
    });
    const caducado = await new JwtService({
      secret: process.env['JWT_SECRETO'] ?? '',
    }).signAsync({ sub: 'E1', exp: Math.floor(Date.now() / 1000) - 60 });

    for (const falso of [
      `${cabecera}.${contenidoFalso}.${firma}`,
      sinFirma,
      otroSecreto,
      caducado,
    ]) {
      expect(
        (await obtener('/acceso/sesion', `${COOKIE}=${falso}`)).status,
      ).toBe(401);
    }
  });

  it('el rol sale de la BD, no del claim del token (ajuste C)', async () => {
    const tokenConRolFalso = await new JwtService({
      secret: process.env['JWT_SECRETO'] ?? '',
    }).signAsync({ sub: 'E1', rol: 'PSICOLOGO' }, { algorithm: 'HS256' });
    const cookie = `${COOKIE}=${tokenConRolFalso}`;
    expect((await obtener('/prueba/accion/cerrarCaso', cookie)).status).toBe(
      403,
    );
    expect(
      (await obtener('/prueba/accion/consultarRegistros', cookie)).status,
    ).toBe(200);
  });
});

describe('control de acceso por rol', () => {
  it.each(USUARIOS)(
    '%s: ejecuta su acción (200) y es rechazado fuera de su rol (403)',
    async (_rol, correo, propia, ajena) => {
      const cookie = await sesionDe(correo);
      expect((await obtener(`/prueba/accion/${propia}`, cookie)).status).toBe(
        200,
      );
      expect((await obtener(`/prueba/accion/${ajena}`, cookie)).status).toBe(
        403,
      );
    },
  );

  it.each([
    ['el psicólogo asignado', 'ps1@ejemplo.edu.co', true],
    ['otro psicólogo', 'ps2@ejemplo.edu.co', false],
    ['el Jefe', 'j1@ejemplo.edu.co', false],
    ['el Docente', 'd1@ejemplo.edu.co', false],
    ['el Estudiante', 'e1@ejemplo.edu.co', false],
  ])('caso confidencial: %s %s ve el motivo', async (_quien, correo, loVe) => {
    const respuesta = await obtener(
      `/prueba/caso/${idCasoConfidencial}`,
      await sesionDe(correo),
    );
    expect(respuesta.status).toBe(200);
    expect((await respuesta.json()).motivo).toBe(
      loVe ? 'Necesito apoyo' : null,
    );
  });
});

describe('activación de cuenta por enlace (D6)', () => {
  async function solicitar(correo: string): Promise<Response> {
    return fetch(`${servidor.url}/acceso/solicitar-activacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo }),
    });
  }

  async function esperarCorreos(cantidad: number): Promise<void> {
    for (
      let i = 0;
      i < 100 && servidor.correo.enviados.length < cantidad;
      i++
    ) {
      await new Promise((resolver) => setTimeout(resolver, 50));
    }
  }

  it('solicitud → correo → activación con el token en el cuerpo → inicio de sesión; el token no se reutiliza', async () => {
    servidor.correo.enviados.length = 0;
    const respuesta = await solicitar('e2@ejemplo.edu.co');
    expect(respuesta.status).toBe(202);
    await esperarCorreos(1);
    const enviado = servidor.correo.enviados[0];
    expect(enviado?.destino).toBe('e2@ejemplo.edu.co');
    const token =
      /\/activar#token=([A-Za-z0-9_-]{43})/.exec(
        enviado?.cuerpoHtml ?? '',
      )?.[1] ?? '';

    // El token en la URL (query) no sirve: debe ir en el cuerpo (ajuste E).
    const enUrl = await fetch(`${servidor.url}/acceso/activar?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrasena: 'Nueva-contraseña-segura' }),
    });
    expect(enUrl.status).toBe(400);

    const activar = () =>
      fetch(`${servidor.url}/acceso/activar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, contrasena: 'Nueva-contraseña-segura' }),
      });
    expect((await activar()).status).toBe(204);
    expect(
      (await iniciarSesion('e2@ejemplo.edu.co', 'Nueva-contraseña-segura'))
        .status,
    ).toBe(200);
    const reutilizado = await activar();
    expect(reutilizado.status).toBe(400);
    expect((await reutilizado.json()).message).toBe(
      'El enlace no es válido o ya caducó',
    );
  });

  it('correo inexistente: el mismo 202 y el mismo cuerpo, sin correo enviado', async () => {
    servidor.correo.enviados.length = 0;
    const existente = await solicitar('d1@ejemplo.edu.co');
    const inexistente = await solicitar('nadie@ejemplo.edu.co');
    expect(inexistente.status).toBe(existente.status);
    expect(await inexistente.text()).toBe(await existente.text());
    await esperarCorreos(1);
    await new Promise((resolver) => setTimeout(resolver, 200));
    expect(servidor.correo.enviados.map((c) => c.destino)).toEqual([
      'd1@ejemplo.edu.co',
    ]);
  });
});

describe('CORS (ajuste D)', () => {
  it('admite solo el origen exacto de URL_FRONTEND, con credenciales', async () => {
    const preflight = (origen: string) =>
      fetch(`${servidor.url}/acceso/iniciar-sesion`, {
        method: 'OPTIONS',
        headers: {
          Origin: origen,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
    const propio = await preflight(URL_FRONTEND);
    expect(propio.headers.get('access-control-allow-origin')).toBe(
      URL_FRONTEND,
    );
    expect(propio.headers.get('access-control-allow-credentials')).toBe('true');
    const ajeno = await preflight('http://malicioso.example');
    expect(ajeno.headers.get('access-control-allow-origin')).toBeNull();
  });
});
