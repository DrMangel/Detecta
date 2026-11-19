import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import {
  PROVEEDOR_CORREO,
  type ProveedorCorreo,
} from '../src/aplicacion/contratos/proveedor-correo';
import { hashContrasenas } from '../src/aplicacion/servicios/hash-contrasenas';
import { RELOJ } from '../src/aplicacion/servicios/servicio-autenticacion';
import { ServicioNotificacion } from '../src/aplicacion/servicios/servicio-notificacion';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import type {
  CasoDto,
  DetalleDto,
} from '../src/controladores/respuestas-casos';
import { RutaAtencion } from '../src/dominio/entidades/ruta-atencion';
import { validarEntorno } from '../src/validacion-entorno';
import {
  casoDeAlerta,
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
  PERIODO,
  type Escenario,
  type Repositorios,
} from './integracion/escenario';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './integracion/soporte';

/*
 * Caso de riesgo de punta a punta (criterio de cierre de B7), por HTTP real
 * contra detecta_pruebas, con un doble de ProveedorCorreo y reloj fijo
 * (respuesta 11 del plan de B7).
 */

const CONTRASENA = 'Contraseña-de-prueba-1';
/** Reloj fijo: 18/11/2026 15:00 UTC (10:00 en Bogotá). */
const AHORA = new Date('2026-11-18T15:00:00Z');

class ProveedorCorreoEnMemoria implements ProveedorCorreo {
  readonly enviados: { destino: string; asunto: string; cuerpo: string }[] = [];
  enviar(destino: string, asunto: string, cuerpo: string): Promise<boolean> {
    this.enviados.push({ destino, asunto, cuerpo });
    return Promise.resolve(true);
  }
}

type CuerpoGeneral = {
  message?: string;
  mensaje?: string;
  caso?: CasoDto;
};

interface Respuesta<T> {
  estado: number;
  cuerpo: T;
}

let app: INestApplication;
let url: string;
let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
const correo = new ProveedorCorreoEnMemoria();
const sesiones = new Map<string, string>();
const tiempos: Record<string, number[]> = { bandeja: [] };

async function sesion(usuario: string): Promise<string> {
  const guardada = sesiones.get(usuario);
  if (guardada) {
    return guardada;
  }
  const respuesta = await fetch(`${url}/acceso/iniciar-sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: usuario, contrasena: CONTRASENA }),
  });
  expect(respuesta.status).toBe(200);
  const cookie =
    respuesta.headers
      .getSetCookie()
      .find((valor) => valor.startsWith('detecta_sesion='))
      ?.split(';')[0] ?? '';
  sesiones.set(usuario, cookie);
  return cookie;
}

async function pedir<T = CuerpoGeneral>(
  usuario: string,
  metodo: 'GET' | 'POST',
  ruta: string,
  cuerpo?: unknown,
  medir?: string,
): Promise<Respuesta<T>> {
  const inicio = performance.now();
  const respuesta = await fetch(`${url}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      Cookie: await sesion(usuario),
    },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  const texto = await respuesta.text();
  if (medir) {
    tiempos[medir]?.push(performance.now() - inicio);
  }
  return {
    estado: respuesta.status,
    cuerpo: (texto === '' ? null : JSON.parse(texto)) as T,
  };
}

async function esperarCorreos(): Promise<void> {
  await app.get(ServicioNotificacion).onApplicationShutdown();
}

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
  esc = await crearEscenario(repos);
  await fuente.query('UPDATE persona SET contrasena_hash = $1', [
    await hashContrasenas.generar(CONTRASENA, 10),
  ]);

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService(
        validarEntorno({ ...process.env, BD_DETECTA_NOMBRE: BASE_PRUEBAS }),
      ),
    )
    .overrideProvider(PROVEEDOR_CORREO)
    .useValue(correo)
    .overrideProvider(RELOJ)
    .useValue(() => new Date(AHORA))
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});

afterAll(async () => {
  await app.close();
  await fuente.destroy();
  const resumen = Object.fromEntries(
    Object.entries(tiempos).map(([clave, valores]) => [
      clave,
      {
        n: valores.length,
        maxMs: Math.round(Math.max(...valores)),
        medianaMs: Math.round(
          [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)] ??
            0,
        ),
      },
    ]),
  );
  process.stdout.write(`TIEMPOS_B7 ${JSON.stringify(resumen)}\n`);
});

describe('B7a: bandeja y canalización del Jefe (R03, sd_CUD04, D18)', () => {
  it('la bandeja tiene la alerta y la solicitud académica (con su motivo), nunca la psicosocial; su detalle y su canalización dan 403', async () => {
    const alerta = await casoDeAlerta(repos, esc.d1, esc.r1);
    const academica = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.ACADEMICA,
    );
    const psicosocial = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );

    const bandeja = await pedir<CasoDto[]>(
      'j1@ejemplo.edu.co',
      'GET',
      '/casos/pendientes',
      undefined,
      'bandeja',
    );
    expect(bandeja.estado).toBe(200);
    const ids = bandeja.cuerpo.map((c) => c.idCaso);
    expect(ids).toEqual(
      expect.arrayContaining([alerta.caso.idCaso, academica.caso.idCaso]),
    );
    expect(ids).not.toContain(psicosocial.caso.idCaso);
    expect(
      bandeja.cuerpo.find((c) => c.idCaso === academica.caso.idCaso)?.origen,
    ).toMatchObject({
      tipo: 'SOLICITUD',
      motivo: 'Necesito apoyo',
      disponibilidad: 'Lunes en la tarde',
    });
    expect(JSON.stringify(bandeja.cuerpo)).not.toContain(
      psicosocial.caso.idCaso,
    );

    expect(
      (
        await pedir(
          'j1@ejemplo.edu.co',
          'GET',
          `/casos/${psicosocial.caso.idCaso}`,
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await pedir(
          'j1@ejemplo.edu.co',
          'POST',
          `/casos/${psicosocial.caso.idCaso}/canalizacion`,
          { ruta: 'ACADEMICA' },
        )
      ).estado,
    ).toBe(403);

    const detalle = await pedir<DetalleDto<CasoDto>>(
      'j1@ejemplo.edu.co',
      'GET',
      `/casos/${alerta.caso.idCaso}`,
      undefined,
      'bandeja',
    );
    expect(detalle.estado).toBe(200);
    expect(detalle.cuerpo.antecedentes.map((r) => r.idRegistro).sort()).toEqual(
      ['R0', 'R1'],
    );
  });

  it('canalizar a psicología notifica a los psicólogos; el Jefe deja de ver el motivo; el estudiante sigue viendo PENDIENTE (D27: canalizar a psicología deja el caso PENDIENTE)', async () => {
    const academica = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.ACADEMICA,
    );
    correo.enviados.length = 0;
    const respuesta = await pedir(
      'j1@ejemplo.edu.co',
      'POST',
      `/casos/${academica.caso.idCaso}/canalizacion`,
      {
        ruta: 'PSICOLOGICA',
      },
    );
    expect(respuesta.estado).toBe(200);
    expect(respuesta.cuerpo.mensaje).toBe('Caso remitido a psicología');
    await esperarCorreos();
    expect(correo.enviados.map((c) => c.destino)).toEqual([
      'ps1@ejemplo.edu.co',
    ]);

    const detalle = await pedir<DetalleDto<CasoDto>>(
      'j1@ejemplo.edu.co',
      'GET',
      `/casos/${academica.caso.idCaso}`,
    );
    expect(detalle.cuerpo.caso.ruta).toBe('PSICOLOGICA');
    expect(JSON.stringify(detalle.cuerpo)).not.toMatch(
      /Necesito apoyo|Lunes en la tarde/,
    );

    const propias = await pedir<{ codigo: string; estado: string }[]>(
      'e2@ejemplo.edu.co',
      'GET',
      '/consulta/solicitudes',
    );
    expect(
      propias.cuerpo.find((s) => s.codigo === academica.solicitud.idOrigen)
        ?.estado,
    ).toBe('PENDIENTE');
  });

  it('dos sesiones canalizan a la vez: una gana y la otra recibe «El caso ya fue canalizado»', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r2);
    const [a, b] = await Promise.all([
      pedir('j1@ejemplo.edu.co', 'POST', `/casos/${caso.idCaso}/canalizacion`, {
        ruta: 'ACADEMICA',
      }),
      pedir('j1@ejemplo.edu.co', 'POST', `/casos/${caso.idCaso}/canalizacion`, {
        ruta: 'PSICOLOGICA',
      }),
    ]);
    expect([a.estado, b.estado].sort((x, y) => x - y)).toEqual([200, 409]);
    expect([a, b].find((r) => r.estado === 409)?.cuerpo.message).toBe(
      'El caso ya fue canalizado',
    );
    const emitidas = await pedir<
      { idAlerta: string; estadoAtencion: string }[]
    >('d1@ejemplo.edu.co', 'GET', `/alertas/emitidas?periodo=${PERIODO}`);
    // D27: la ruta académica deja el caso EN_NIVELACION (ATENDIDA); la
    // psicológica lo deja PENDIENTE hasta que un psicólogo lo tome.
    const ganadora = [a, b].find((r) => r.estado === 200)?.cuerpo.caso?.ruta;
    expect(
      emitidas.cuerpo.find((x) => x.idAlerta === caso.origen.idOrigen)
        ?.estadoAtencion,
    ).toBe(ganadora === 'ACADEMICA' ? 'ATENDIDA' : 'PENDIENTE');
  });

  it('roles cruzados y caso de otro programa: 403', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r3); // E3 cursa P2
    expect(
      (await pedir('j1@ejemplo.edu.co', 'GET', `/casos/${caso.idCaso}`)).estado,
    ).toBe(403);
    expect(
      (await pedir('ps1@ejemplo.edu.co', 'GET', '/casos/pendientes')).estado,
    ).toBe(403);
    expect(
      (
        await pedir(
          'd1@ejemplo.edu.co',
          'POST',
          `/casos/${caso.idCaso}/canalizacion`,
          { ruta: 'ACADEMICA' },
        )
      ).estado,
    ).toBe(403);
  });
});
