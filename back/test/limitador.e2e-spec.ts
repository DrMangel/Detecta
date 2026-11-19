import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import { hashContrasenas } from '../src/aplicacion/servicios/hash-contrasenas';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import {
  crearLimitadores,
  LIMITADORES,
} from '../src/controladores/limitador-peticiones';
import {
  FALLOS_INICIO_POR_IP_Y_CORREO,
  SOLICITUDES_ACTIVACION_POR_CORREO,
  VENTANA_INICIO_SESION_MS,
} from '../src/controladores/limites-peticiones';
import { validarEntorno } from '../src/validacion-entorno';
import { crearEscenario, crearRepositorios } from './integracion/escenario';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './integracion/soporte';

/*
 * Limitador de peticiones por HTTP (fase B9, D15; ajuste A). Los limitadores
 * se sustituyen en el módulo por unos con reloj controlado (ajuste A: en
 * pruebas se sobrescriben; no hay variable para desactivarlos).
 */

const CONTRASENA = 'Contraseña-de-prueba-1';
let ahora = Date.parse('2026-11-19T15:00:00Z');
let app: INestApplication;
let url: string;
let fuente: DataSource;

const enviar = (ruta: string, cuerpo: unknown) =>
  fetch(`${url}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  await crearEscenario(crearRepositorios(fuente));
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
    .overrideProvider(LIMITADORES)
    .useValue(crearLimitadores(() => new Date(ahora)))
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});

afterAll(async () => {
  await app.close();
  await fuente.destroy();
});

describe('Limitador por HTTP (B9, ajuste A)', () => {
  it('inicio de sesión: tras los fallos del par, 429 con el texto aprobado y Retry-After; al vencer la ventana vuelve a funcionar', async () => {
    for (let i = 0; i < FALLOS_INICIO_POR_IP_Y_CORREO; i++) {
      expect(
        (
          await enviar('/acceso/iniciar-sesion', {
            correo: 'e1@ejemplo.edu.co',
            contrasena: 'incorrecta-12345',
          })
        ).status,
      ).toBe(401);
    }
    const bloqueado = await enviar('/acceso/iniciar-sesion', {
      correo: 'e1@ejemplo.edu.co',
      contrasena: CONTRASENA,
    });
    expect(bloqueado.status).toBe(429);
    expect((await bloqueado.json()).message).toBe(
      'Demasiados intentos. Intente de nuevo más tarde.',
    );
    const espera = Number(bloqueado.headers.get('retry-after'));
    expect(espera).toBeGreaterThan(0);
    expect(espera).toBeLessThanOrEqual(VENTANA_INICIO_SESION_MS / 1000);
    // Las cabeceras de seguridad de B9 también van en el 429.
    expect(bloqueado.headers.get('x-content-type-options')).toBe('nosniff');

    ahora += VENTANA_INICIO_SESION_MS + 1;
    expect(
      (
        await enviar('/acceso/iniciar-sesion', {
          correo: 'e1@ejemplo.edu.co',
          contrasena: CONTRASENA,
        })
      ).status,
    ).toBe(200);
  });

  it('activación: el mismo 202 para un correo existente o no, y el mismo 429 al superar el límite por correo', async () => {
    for (const correo of ['d1@ejemplo.edu.co', 'nadie@ejemplo.edu.co']) {
      const cuerpos: string[] = [];
      for (let i = 0; i < SOLICITUDES_ACTIVACION_POR_CORREO; i++) {
        const respuesta = await enviar('/acceso/solicitar-activacion', {
          correo,
        });
        expect(respuesta.status).toBe(202);
        cuerpos.push(await respuesta.text());
      }
      expect(new Set(cuerpos).size).toBe(1);
      const bloqueado = await enviar('/acceso/solicitar-activacion', {
        correo,
      });
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.headers.get('retry-after')).not.toBeNull();
    }
  });
});
