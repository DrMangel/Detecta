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
import type { PlanDto } from '../src/controladores/controlador-plan-nivelacion';
import { RutaAtencion } from '../src/dominio/entidades/ruta-atencion';
import { validarEntorno } from '../src/validacion-entorno';
import {
  casoDeAlerta,
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
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
 * Plan de nivelación (B8a) e informes de riesgo (B8b) por HTTP real contra
 * detecta_pruebas, con un doble de ProveedorCorreo y reloj fijo.
 */

const CONTRASENA = 'Contraseña-de-prueba-1';
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
  plan?: PlanDto;
};

interface Respuesta<T> {
  estado: number;
  cuerpo: T;
  cabeceras: Headers;
  bytes: Buffer;
}

let app: INestApplication;
let url: string;
let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
const correo = new ProveedorCorreoEnMemoria();
const sesiones = new Map<string, string>();
const tiempos: Record<string, number[]> = { informe: [], exportacion: [] };

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
  const bytes = Buffer.from(await respuesta.arrayBuffer());
  if (medir) {
    tiempos[medir]?.push(performance.now() - inicio);
  }
  const esJson = (respuesta.headers.get('content-type') ?? '').includes('json');
  return {
    estado: respuesta.status,
    cuerpo: (esJson && bytes.length > 0
      ? JSON.parse(bytes.toString('utf8'))
      : null) as T,
    cabeceras: respuesta.headers,
    bytes,
  };
}

async function esperarCorreos(): Promise<void> {
  await app.get(ServicioNotificacion).onApplicationShutdown();
}

/** Caso académico de E1 canalizado a la ruta académica por el Jefe. */
async function casoAcademico(): Promise<string> {
  const { caso } = await casoDeSolicitud(repos, esc.e1, RutaAtencion.ACADEMICA);
  caso.canalizar(RutaAtencion.ACADEMICA);
  await repos.casos.guardar(caso);
  return caso.idCaso;
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
    Object.entries(tiempos)
      .filter(([, valores]) => valores.length > 0)
      .map(([clave, valores]) => [
        clave,
        {
          n: valores.length,
          maxMs: Math.round(Math.max(...valores)),
          medianaMs: Math.round(
            [...valores].sort((a, b) => a - b)[
              Math.floor(valores.length / 2)
            ] ?? 0,
          ),
        },
      ]),
  );
  process.stdout.write(`TIEMPOS_B8 ${JSON.stringify(resumen)}\n`);
});

describe('B8a: plan de nivelación (R04, CUD05)', () => {
  it('estructura el plan sobre el caso EN_NIVELACION, notifica al estudiante y lo finaliza; el caso sigue EN_NIVELACION', async () => {
    const idCaso = await casoAcademico();
    correo.enviados.length = 0;
    const registro = await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
      idCaso,
      idsCursos: ['C1'],
      tutorNombre: 'Tutor Uno',
      tutorCodigo: 'T-001',
    });
    expect(registro.estado).toBe(201);
    expect(registro.cuerpo.mensaje).toBe('Plan de nivelación registrado');
    await esperarCorreos();
    expect(correo.enviados.map((c) => [c.destino, c.asunto])).toEqual([
      ['e1@ejemplo.edu.co', 'DETECTA: plan de nivelación académica'],
    ]);
    expect(correo.enviados[0]?.cuerpo).not.toMatch(/Cálculo|Tutor Uno|T-001/);

    const idPlan = registro.cuerpo.plan?.idPlan ?? '';
    const fin = await pedir<{ plan: PlanDto }>(
      'j1@ejemplo.edu.co',
      'POST',
      `/planes/${idPlan}/finalizacion`,
    );
    expect(fin.estado).toBe(200);
    expect(fin.cuerpo.plan.estado).toBe('FINALIZADO');
    const [fila] = await fuente.query<{ estado: string }[]>(
      'SELECT estado FROM caso_riesgo WHERE id_caso = $1',
      [idCaso],
    );
    expect(fila?.estado).toBe('EN_NIVELACION');
    expect(
      await pedir(
        'j1@ejemplo.edu.co',
        'POST',
        `/planes/${idPlan}/finalizacion`,
      ),
    ).toMatchObject({
      estado: 409,
      cuerpo: { message: 'El plan de nivelación ya está finalizado' },
    });
  });

  it('dos sesiones finalizan el mismo plan a la vez: una lo finaliza y la otra recibe 409', async () => {
    const idCaso = await casoAcademico();
    const registro = await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
      idCaso,
      idsCursos: ['C1', 'C0'],
      tutorNombre: 'Tutor',
      tutorCodigo: 'T2',
    });
    const idPlan = registro.cuerpo.plan?.idPlan ?? '';
    const [a, b] = await Promise.all([
      pedir('j1@ejemplo.edu.co', 'POST', `/planes/${idPlan}/finalizacion`),
      pedir('j1@ejemplo.edu.co', 'POST', `/planes/${idPlan}/finalizacion`),
    ]);
    expect([a.estado, b.estado].sort((x, y) => x - y)).toEqual([200, 409]);
  });

  it('validaciones: tutor, cursos sin registro del estudiante, caso de otra ruta o de otro programa', async () => {
    const idCaso = await casoAcademico();
    expect(
      await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
        idCaso,
        idsCursos: ['C1'],
        tutorNombre: 'Tutor',
        tutorCodigo: ' ',
      }),
    ).toMatchObject({
      estado: 400,
      cuerpo: { message: 'Faltan los datos del estudiante tutor' },
    });
    // E1 no tiene registro en un curso que no existe ni en C9; C1 y C0 sí.
    expect(
      (
        await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
          idCaso,
          idsCursos: ['C9'],
          tutorNombre: 'T',
          tutorCodigo: 'T',
        })
      ).estado,
    ).toBe(400);
    const alerta = await casoDeAlerta(repos, esc.d1, esc.r1);
    alerta.caso.canalizar(RutaAtencion.PSICOLOGICA);
    await repos.casos.guardar(alerta.caso);
    expect(
      (
        await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
          idCaso: alerta.caso.idCaso,
          idsCursos: ['C1'],
          tutorNombre: 'T',
          tutorCodigo: 'T',
        })
      ).estado,
    ).toBe(409);
    const ajeno = await casoDeAlerta(repos, esc.d1, esc.r3); // E3 cursa P2
    expect(
      (
        await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
          idCaso: ajeno.caso.idCaso,
          idsCursos: ['C1'],
          tutorNombre: 'T',
          tutorCodigo: 'T',
        })
      ).estado,
    ).toBe(403);
    expect(
      (
        await pedir('ps1@ejemplo.edu.co', 'POST', '/planes', {
          idCaso,
          idsCursos: ['C1'],
          tutorNombre: 'T',
          tutorCodigo: 'T',
        })
      ).estado,
    ).toBe(403);
  });
});
