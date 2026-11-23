import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import { validarEntorno } from '../src/validacion-entorno';
import { BASE_PRUEBAS, migrarBasePruebas } from './integracion/soporte';

/*
 * GET /salud (F6, cambio operativo aprobado por Ivan): ruta pública para el
 * monitor externo que mantiene despierto el servicio gratuito (J3). Responde
 * 200 con un cuerpo fijo, sin sesión, sin cookie y sin contar contra el
 * limitador.
 */

let app: INestApplication;
let url: string;

beforeAll(async () => {
  await migrarBasePruebas();
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService(
        validarEntorno({ ...process.env, BD_DETECTA_NOMBRE: BASE_PRUEBAS }),
      ),
    )
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});

afterAll(async () => {
  await app.close();
});

describe('GET /salud (F6)', () => {
  it('responde 200 con el cuerpo fijo, sin sesión y sin cookie', async () => {
    const respuesta = await fetch(`${url}/salud`);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toBe('{"estado":"ok"}');
    expect(respuesta.headers.get('set-cookie')).toBeNull();
    expect(respuesta.headers.get('x-content-type-options')).toBe('nosniff');
    expect(respuesta.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  it('no cuenta contra el limitador: 30 peticiones seguidas dan 200', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 30 }, () => fetch(`${url}/salud`)),
    );
    expect(respuestas.map((r) => r.status)).toEqual(Array(30).fill(200));
    expect(respuestas.some((r) => r.headers.has('retry-after'))).toBe(false);
  });

  it('solo admite GET', async () => {
    const respuesta = await fetch(`${url}/salud`, { method: 'POST' });
    expect(respuesta.status).toBe(404);
  });
});
