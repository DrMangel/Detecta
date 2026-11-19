import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configurarAplicacion } from '../../src/configurar-aplicacion';
import { validarEntorno } from '../../src/validacion-entorno';
import {
  BASE_CARGA,
  BASE_INSTITUCIONAL_CARGA,
  maquina,
  reportar,
} from './soporte-carga';

/*
 * Ajuste 3c: intento de reproducir el ECONNRESET de la primera ronda de M4.
 * Hipótesis: carrera de keep-alive. El servidor cierra una conexión ociosa a
 * los keepAliveTimeout ms (5 s por defecto en Node) justo cuando el cliente la
 * reutiliza.
 *
 * Alcance reducido por Ivan (19/11/2026): UN solo intento, con el cliente de
 * M4 (fetch/undici, keep-alive): calentamiento de 50 peticiones simultáneas
 * (abre 50 conexiones), pausa de más de 5 s y ráfaga de 200. Tope de 15 min.
 * Si no hay fallos, el informe registra «no reproducido».
 *
 * La ruta es GET /acceso/sesion sin cookie (401): no toca la base de datos.
 * Mide la configuración que deja configurarAplicacion.
 */

/** Pausa ociosa en ms: algo más que keepAliveTimeout (5000). */
const PAUSA_MS = 5_100;
const CALENTAMIENTO = 50;
const RAFAGA = 200;
/** Tope pedido por Ivan para el intento completo. */
const TOPE_MS = 15 * 60_000;

let app: INestApplication;
let servidor: Server;
let puerto: number;

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService(
        validarEntorno({
          ...process.env,
          BD_DETECTA_NOMBRE: BASE_CARGA,
          BD_INSTITUCIONAL_NOMBRE: BASE_INSTITUCIONAL_CARGA,
        }),
      ),
    )
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  servidor = app.getHttpServer() as Server;
  puerto = Number(new URL(await app.getUrl()).port);
}, 120_000);

afterAll(async () => {
  await app?.close();
});

async function peticion(): Promise<number> {
  const respuesta = await fetch(`http://127.0.0.1:${puerto}/acceso/sesion`);
  await respuesta.arrayBuffer();
  return respuesta.status;
}

async function lote(n: number) {
  const errores: Record<string, number> = {};
  const estados = await Promise.all(
    Array.from({ length: n }, () =>
      peticion().catch(
        (error: { code?: string; cause?: { code?: string } }) => {
          const codigo = error.cause?.code ?? error.code ?? 'DESCONOCIDO';
          errores[codigo] = (errores[codigo] ?? 0) + 1;
          return 0;
        },
      ),
    ),
  );
  return { errores, fallidas: estados.filter((e) => e !== 401).length };
}

it(
  'ECONNRESET tras una pausa de más de 5 s con cliente keep-alive (un intento)',
  async () => {
    const calentamiento = await lote(CALENTAMIENTO);
    await new Promise((resolver) => setTimeout(resolver, PAUSA_MS));
    const rafaga = await lote(RAFAGA);
    reportar('KEEP_ALIVE', {
      ...maquina(),
      servidor: {
        keepAliveTimeoutMs: servidor.keepAliveTimeout,
        headersTimeoutMs: servidor.headersTimeout,
      },
      cliente: 'fetch-undici',
      pausaMs: PAUSA_MS,
      calentamiento,
      rafaga,
      reproducido: rafaga.fallidas > 0,
    });
    // Registro, no criterio: la conclusión va en el informe.
    expect(rafaga.fallidas).toBeGreaterThanOrEqual(0);
  },
  TOPE_MS,
);
