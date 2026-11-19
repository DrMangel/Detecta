import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import { validarEntorno } from '../src/validacion-entorno';
import { crearEscenario, crearRepositorios } from './integracion/escenario';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './integracion/soporte';

/*
 * Cabeceras de seguridad (fase B9, S7; respuesta 5 y ajuste E de Ivan), en
 * una ruta pública y en una protegida, con COOKIE_SEGURA en true y en false.
 */

let fuente: DataSource;

async function levantar(
  cookieSegura: boolean,
): Promise<{ app: INestApplication; url: string; cookie: string }> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService(
        validarEntorno({
          ...process.env,
          BD_DETECTA_NOMBRE: BASE_PRUEBAS,
          COOKIE_SEGURA: String(cookieSegura),
        }),
      ),
    )
    .compile();
  const app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  const token = await app
    .get(JwtService)
    .signAsync(
      { sub: 'E1', rol: 'ESTUDIANTE' },
      { algorithm: 'HS256', expiresIn: 600 },
    );
  return { app, url: await app.getUrl(), cookie: `detecta_sesion=${token}` };
}

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  await crearEscenario(crearRepositorios(fuente));
});

afterAll(async () => {
  await fuente.destroy();
});

describe('Cabeceras de seguridad (B9, S7)', () => {
  it.each([true, false])(
    'COOKIE_SEGURA=%s: cabeceras en rutas públicas y protegidas; HSTS solo con true',
    async (segura) => {
      const { app, url, cookie } = await levantar(segura);
      try {
        const publica = await fetch(`${url}/acceso/sesion`);
        const protegida = await fetch(`${url}/acceso/sesion`, {
          headers: { Cookie: cookie },
        });
        expect(publica.status).toBe(401);
        expect(protegida.status).toBe(200);
        for (const respuesta of [publica, protegida]) {
          expect(respuesta.headers.get('x-powered-by')).toBeNull();
          expect(respuesta.headers.get('x-content-type-options')).toBe(
            'nosniff',
          );
          expect(respuesta.headers.get('x-frame-options')).toBe('DENY');
          expect(respuesta.headers.get('referrer-policy')).toBe('no-referrer');
          expect(respuesta.headers.get('content-security-policy')).toBe(
            "default-src 'none'; frame-ancestors 'none'",
          );
          expect(respuesta.headers.get('strict-transport-security')).toBe(
            segura ? 'max-age=31536000; includeSubDomains' : null,
          );
        }
        // Respuestas autenticadas sin caché (ajuste E) y todo /acceso/*,
        // también sin cookie (ajuste 5).
        expect(protegida.headers.get('cache-control')).toBe('no-store');
        expect(publica.headers.get('cache-control')).toBe('no-store');
      } finally {
        await app.close();
      }
    },
  );
});

describe('Sin caché en /acceso/* (B9, ajuste 5)', () => {
  it('iniciar-sesion, solicitar-activacion y activar responden no-store aunque fallen; fuera de /acceso sin cookie no', async () => {
    const { app, url } = await levantar(true);
    try {
      const pedir = (ruta: string, cuerpo: unknown) =>
        fetch(`${url}${ruta}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        });
      const respuestas = [
        await pedir('/acceso/iniciar-sesion', {
          correo: 'nadie@ejemplo.invalid',
          contrasena: 'incorrecta',
        }),
        await pedir('/acceso/solicitar-activacion', {}),
        await pedir('/acceso/activar', {}),
        // Express enruta sin distinguir mayúsculas.
        await pedir('/ACCESO/iniciar-sesion', {}),
      ];
      for (const respuesta of respuestas) {
        expect(respuesta.status).toBeGreaterThanOrEqual(400);
        expect(respuesta.headers.get('cache-control')).toBe('no-store');
      }
      const ajena = await fetch(`${url}/inexistente`);
      expect(ajena.status).toBe(404);
      expect(ajena.headers.get('cache-control')).toBeNull();
      const parecida = await fetch(`${url}/accesorios`);
      expect(parecida.headers.get('cache-control')).toBeNull();
    } finally {
      await app.close();
    }
  });
});
