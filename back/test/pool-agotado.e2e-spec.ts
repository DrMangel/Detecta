import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import { MENSAJE_ERROR_CONSULTA } from '../src/controladores/respuestas';
import { MENSAJES_PERTINENCIA } from '../src/controladores/controlador-pertinencia';
import type { RepositorioPersona } from '../src/dominio/repositorios/repositorio-persona';
import { REPOSITORIO_PERSONA } from '../src/dominio/repositorios/tokens';
import { RepositorioPersistentePersona } from '../src/persistencia/repositorios-persistentes';
import { validarEntorno } from '../src/validacion-entorno';
import { crearEscenario, crearRepositorios } from './integracion/escenario';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './integracion/soporte';

/*
 * Pool agotado (B9, condición 4 del informe parcial 2):
 * BD_DETECTA_CONEXION_ESPERA_MS limita la espera por una conexión libre. Con
 * el pool lleno, la ruta responde 503 con su propio texto (conPersistencia)
 * al vencer la espera, en lugar de quedar en cola sin límite.
 *
 * Para que el guard pase y sea la RUTA la que encuentre el pool lleno, el
 * repositorio de personas del guard se envuelve: tras buscar a la persona de
 * la sesión, ocupa todas las conexiones del pool (si la prueba lo pide).
 */

const ESPERA_MS = 1000;
const POOL = 2;
/** Margen para el arranque de la petición y la respuesta. */
const MARGEN_MS = 2000;

type PoolPg = {
  connect(): Promise<{ release(): void }>;
  options: { max: number; connectionTimeoutMillis: number };
};

let app: INestApplication;
let url: string;
let fuente: DataSource;
let cookie: string;
let pool: PoolPg;
let agotarTrasGuard = false;
let ocupadas: { release(): void }[] = [];

async function ocuparPool(): Promise<void> {
  for (let i = 0; i < POOL; i++) {
    ocupadas.push(await pool.connect());
  }
}

function liberarPool(): void {
  for (const conexion of ocupadas) {
    conexion.release();
  }
  ocupadas = [];
}

async function pedir(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown) {
  const inicio = performance.now();
  const respuesta = await fetch(`${url}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  const texto = await respuesta.text();
  return {
    estado: respuesta.status,
    cuerpo: (texto ? JSON.parse(texto) : {}) as { message?: string },
    ms: performance.now() - inicio,
  };
}

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  await crearEscenario(crearRepositorios(fuente));
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService(
        validarEntorno({
          ...process.env,
          BD_DETECTA_NOMBRE: BASE_PRUEBAS,
          BD_DETECTA_POOL_MAX: String(POOL),
          BD_DETECTA_CONEXION_ESPERA_MS: String(ESPERA_MS),
        }),
      ),
    )
    .overrideProvider(REPOSITORIO_PERSONA)
    .useFactory({
      factory: (fuenteApp: DataSource): RepositorioPersona => {
        const real = new RepositorioPersistentePersona(fuenteApp);
        return new Proxy(real, {
          get(objetivo, propiedad, receptor) {
            const valor = Reflect.get(objetivo, propiedad, receptor) as unknown;
            if (propiedad !== 'buscarPorId' || typeof valor !== 'function') {
              return typeof valor === 'function' ? valor.bind(objetivo) : valor;
            }
            return async (id: string) => {
              const persona = await real.buscarPorId(id);
              if (agotarTrasGuard) {
                await ocuparPool();
              }
              return persona;
            };
          },
        });
      },
      inject: [DataSource],
    })
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  pool = (app.get(DataSource).driver as unknown as { master: PoolPg }).master;
  const token = await app
    .get(JwtService)
    .signAsync(
      { sub: 'PS1', rol: 'PSICOLOGO' },
      { algorithm: 'HS256', expiresIn: 3600 },
    );
  cookie = `detecta_sesion=${token}`;
});

afterEach(() => {
  agotarTrasGuard = false;
  liberarPool();
});

afterAll(async () => {
  await app.close();
  await fuente.destroy();
});

describe('Pool agotado: espera finita (BD_DETECTA_CONEXION_ESPERA_MS)', () => {
  it('el pool de la aplicación usa el tamaño y la espera configurados', () => {
    expect(pool.options.max).toBe(POOL);
    expect(pool.options.connectionTimeoutMillis).toBe(ESPERA_MS);
  });

  it('escritura con el pool lleno: 503 con el texto de sd_CUD06, sin colgarse', async () => {
    agotarTrasGuard = true;
    const r = await pedir('POST', '/pertinencia/X', {
      pertinente: true,
      justificacion: 'Pertinente',
    });
    expect(r.estado).toBe(503);
    expect(r.cuerpo.message).toBe(MENSAJES_PERTINENCIA.errorExpediente);
    expect(r.ms).toBeGreaterThanOrEqual(ESPERA_MS - 50);
    expect(r.ms).toBeLessThan(ESPERA_MS + MARGEN_MS);
  });

  it('consulta con el pool lleno: 503 «Error al consultar la información», sin colgarse', async () => {
    agotarTrasGuard = true;
    const r = await pedir('GET', '/atencion/casos');
    expect(r.estado).toBe(503);
    expect(r.cuerpo.message).toBe(MENSAJE_ERROR_CONSULTA);
    expect(r.ms).toBeLessThan(ESPERA_MS + MARGEN_MS);
  });

  it('con conexiones libres, el comportamiento no cambia (200 y 403 de siempre)', async () => {
    const bandeja = await pedir('GET', '/atencion/casos');
    expect(bandeja.estado).toBe(200);
    const inexistente = await pedir('POST', '/pertinencia/X', {
      pertinente: true,
      justificacion: 'Pertinente',
    });
    expect(inexistente.estado).toBe(403);
  });

  it('pool lleno ANTES del guard: responde sin colgarse (el guard no traduce el error: 500 genérico, sin cambios)', async () => {
    await ocuparPool();
    const r = await pedir('GET', '/atencion/casos');
    // Comportamiento previo del guard, sin cambios: el error de la base no
    // pasa por conPersistencia. Se reporta como pregunta abierta.
    expect(r.estado).toBe(500);
    expect(r.ms).toBeLessThan(ESPERA_MS + MARGEN_MS);
  });
});
