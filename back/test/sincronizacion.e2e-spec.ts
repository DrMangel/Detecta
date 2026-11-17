import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import { BLOQUEO_SINCRONIZACION } from '../src/aplicacion/servicios/servicio-sincronizacion';
import { AppModule } from '../src/app.module';
import { UnidadTrabajoPersistente } from '../src/persistencia/unidad-trabajo-persistente';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import { validarEntorno } from '../src/validacion-entorno';
import { crearRepositorios } from './integracion/escenario';
import { configurarDetecta } from './integracion/soporte-institucional';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './integracion/soporte';

/*
 * Disparo manual de la sincronización por HTTP (respuesta 8 de Ivan):
 * POST /sincronizacion con Authorization: Bearer <SINCRONIZACION_SECRETO>.
 * Lee institucional_demo (requiere `npm run bd:institucional`) y escribe en
 * detecta_pruebas.
 */

const SECRETO = 'secreto-de-prueba-de-sincronizacion-0123456789';

async function levantar(secreto: string): Promise<{
  app: INestApplication;
  url: string;
}> {
  const configuracion = new ConfigService(
    validarEntorno({
      ...process.env,
      BD_DETECTA_NOMBRE: BASE_PRUEBAS,
      SINCRONIZACION_SECRETO: secreto,
      SINCRONIZACION_HORA_NOCTURNA: '',
    }),
  );
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(configuracion)
    .compile();
  const app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  return { app, url: await app.getUrl() };
}

let servidor: { app: INestApplication; url: string };
let fuente: DataSource;

const sincronizar = (url: string, autorizacion?: string) =>
  fetch(`${url}/sincronizacion`, {
    method: 'POST',
    headers: autorizacion ? { Authorization: autorizacion } : {},
  });

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  await configurarDetecta(crearRepositorios(fuente));
  servidor = await levantar(SECRETO);
});

afterAll(async () => {
  await servidor.app.close();
  await fuente.destroy();
});

describe('POST /sincronizacion', () => {
  it('sin cabecera o con secreto erróneo: 401 y no sincroniza', async () => {
    expect((await sincronizar(servidor.url)).status).toBe(401);
    expect(
      (await sincronizar(servidor.url, 'Bearer otro-secreto')).status,
    ).toBe(401);
    expect((await sincronizar(servidor.url, SECRETO)).status).toBe(401); // sin "Bearer"
    const [{ total }] = await fuente.query(
      'SELECT count(*)::int AS total FROM registro_academico',
    );
    expect(total).toBe(0);
  });

  it('con el secreto correcto: 200 con el resultado y los mensajes de la Tabla 2', async () => {
    const respuesta = await sincronizar(servidor.url, `Bearer ${SECRETO}`);
    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.json();
    expect(cuerpo.cursos).toEqual(['CALC-201', 'FIS-301', 'ISOF-101']);
    expect(cuerpo.actualizados).toBeGreaterThan(60);
    expect(cuerpo.mensajes[0]).toBe(
      'Conexión establecida correctamente con la base de datos institucional.',
    );
    expect(cuerpo.mensajes[1]).toMatch(
      /^Sincronización completada: Se han actualizado \d+ registros académicos en la persistencia del sistema\.$/,
    );
    expect(cuerpo.desglose.datosInconsistentesEstudiante).toBe(2);
  });

  it('con una sincronización en curso: 409 de inmediato con el mensaje de sincronización en curso', async () => {
    let liberar: () => void = () => undefined;
    let bloqueado: () => void = () => undefined;
    const enCurso = new Promise<void>((resolver) => (bloqueado = resolver));
    const retencion = new UnidadTrabajoPersistente(fuente).ejecutar(
      () =>
        new Promise<void>((resolver) => {
          liberar = resolver;
          bloqueado();
        }),
      { bloqueoExclusivo: BLOQUEO_SINCRONIZACION },
    );
    await enCurso;
    try {
      const inicio = performance.now();
      const respuesta = await sincronizar(servidor.url, `Bearer ${SECRETO}`);
      const ms = performance.now() - inicio;
      expect(respuesta.status).toBe(409);
      expect((await respuesta.json()).message).toBe(
        'Ya hay una sincronización en curso; intente más tarde.',
      );
      expect(ms).toBeLessThan(1000);
    } finally {
      liberar();
      await retencion;
    }
  });

  it('la ruta no exige sesión de usuario ni la acepta como sustituto del secreto', async () => {
    const respuesta = await fetch(`${servidor.url}/sincronizacion`, {
      method: 'POST',
      headers: { Cookie: 'detecta_sesion=cualquier-cosa' },
    });
    expect(respuesta.status).toBe(401);
  });

  it('sin SINCRONIZACION_SECRETO configurado: 404', async () => {
    const sinSecreto = await levantar('');
    try {
      expect(
        (await sincronizar(sinSecreto.url, `Bearer ${SECRETO}`)).status,
      ).toBe(404);
    } finally {
      await sinSecreto.app.close();
    }
  });
});
