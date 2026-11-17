import type { INestApplication, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import {
  PROVEEDOR_CORREO,
  type ProveedorCorreo,
} from '../src/aplicacion/contratos/proveedor-correo';
import { HASH_SIN_ACTIVAR } from '../src/aplicacion/servicios/hash-contrasenas';
import { ServicioAutenticacion } from '../src/aplicacion/servicios/servicio-autenticacion';
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
import {
  decodificarQuotedPrintable,
  generarCertificadoPrueba,
  levantarServidorMudo,
  levantarServidorSmtp,
  proveedorPrueba,
  type CertificadoPrueba,
  type ServidorSmtpPrueba,
} from './soporte-smtp';
import { problemasHtml } from './verificar-html';

/*
 * Correos de activación y recuperación (B3) por el adaptador SMTP real
 * contra un servidor local (B5):
 * - el enlace `${URL_FRONTEND}/activar#token=…` llega intacto y sirve;
 * - el token nunca aparece en registros ni en errores, aunque el servidor
 *   SMTP lo devuelva en su respuesta de rechazo;
 * - ajuste A: la respuesta HTTP es idéntica si el envío falla y su tiempo
 *   no depende del envío; la espera determinista es
 *   ServicioAutenticacion.onApplicationShutdown().
 */

const URL_FRONTEND = 'http://localhost:5173';
const PATRON_TOKEN = /\/activar#token=([A-Za-z0-9_-]{43})/;

/** Delega en el adaptador real del escenario de cada prueba. */
class ProveedorConmutable implements ProveedorCorreo {
  actual: ProveedorCorreo | null = null;
  enviar(destino: string, asunto: string, cuerpoHtml: string) {
    if (this.actual === null) {
      throw new Error('Proveedor de prueba sin configurar');
    }
    return this.actual.enviar(destino, asunto, cuerpoHtml);
  }
}

/** Todo lo que la aplicación escribe: logger de Nest, consola, stdout y stderr. */
class CapturaSalida implements LoggerService {
  readonly lineas: string[] = [];
  #restaurar: (() => void)[] = [];

  log(...partes: unknown[]) {
    this.#guardar(partes);
  }
  error(...partes: unknown[]) {
    this.#guardar(partes);
  }
  warn(...partes: unknown[]) {
    this.#guardar(partes);
  }
  debug(...partes: unknown[]) {
    this.#guardar(partes);
  }
  verbose(...partes: unknown[]) {
    this.#guardar(partes);
  }
  fatal(...partes: unknown[]) {
    this.#guardar(partes);
  }

  interceptarProceso(): void {
    for (const flujo of [process.stdout, process.stderr]) {
      const original = flujo.write.bind(flujo);
      flujo.write = ((parte: unknown, ...resto: unknown[]) => {
        this.lineas.push(String(parte));
        return (original as (...a: unknown[]) => boolean)(parte, ...resto);
      }) as typeof flujo.write;
      this.#restaurar.push(() => {
        flujo.write = original;
      });
    }
    for (const nivel of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      const espia = jest
        .spyOn(console, nivel)
        .mockImplementation((...partes: unknown[]) => this.#guardar(partes));
      this.#restaurar.push(() => espia.mockRestore());
    }
  }

  restaurar(): void {
    for (const restaurar of this.#restaurar.splice(0)) {
      restaurar();
    }
  }

  #guardar(partes: unknown[]) {
    this.lineas.push(
      partes
        .map((parte) =>
          parte instanceof Error
            ? `${parte.name} ${parte.message} ${parte.stack ?? ''}`
            : typeof parte === 'string'
              ? parte
              : JSON.stringify(parte),
        )
        .join(' '),
    );
  }
}

let app: INestApplication;
let url: string;
let fuente: DataSource;
let certificado: CertificadoPrueba;
let autenticacion: ServicioAutenticacion;
const proveedor = new ProveedorConmutable();
const salida = new CapturaSalida();

async function solicitar(correo: string): Promise<{
  estado: number;
  cuerpo: string;
  cabeceras: Record<string, string>;
  duracionMs: number;
}> {
  const inicio = performance.now();
  const respuesta = await fetch(`${url}/acceso/solicitar-activacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo }),
  });
  const cuerpo = await respuesta.text();
  const duracionMs = performance.now() - inicio;
  const cabeceras = Object.fromEntries(
    [...respuesta.headers].filter(
      ([nombre]) => !['date', 'etag'].includes(nombre),
    ),
  );
  return { estado: respuesta.status, cuerpo, cabeceras, duracionMs };
}

/** Escenario con el adaptador real apuntando a un servidor local. */
async function conServidor<T>(
  servidor: { puerto: number; cerrar(): Promise<void> },
  prueba: () => Promise<T>,
): Promise<T> {
  const adaptador = proveedorPrueba(servidor.puerto, certificado);
  proveedor.actual = adaptador;
  try {
    return await prueba();
  } finally {
    await autenticacion.onApplicationShutdown();
    adaptador.onModuleDestroy();
    proveedor.actual = null;
    await servidor.cerrar();
  }
}

function tokenDe(servidor: ServidorSmtpPrueba): string {
  const crudo = decodificarQuotedPrintable(servidor.recibidos[0]?.crudo ?? '');
  return PATRON_TOKEN.exec(crudo)?.[1] ?? '';
}

beforeAll(async () => {
  certificado = generarCertificadoPrueba();
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  await crearEscenario(crearRepositorios(fuente));
  await fuente.query('UPDATE persona SET contrasena_hash = $1', [
    HASH_SIN_ACTIVAR,
  ]);

  const configuracion = new ConfigService(
    validarEntorno({
      ...process.env,
      BD_DETECTA_NOMBRE: BASE_PRUEBAS,
      URL_FRONTEND,
    }),
  );
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(configuracion)
    .overrideProvider(PROVEEDOR_CORREO)
    .useValue(proveedor)
    .compile();
  app = modulo.createNestApplication({ logger: salida });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  autenticacion = app.get(ServicioAutenticacion);
});

beforeEach(() => salida.interceptarProceso());
afterEach(() => salida.restaurar());

afterAll(async () => {
  await app.close();
  await fuente.destroy();
});

describe('correo de activación por SMTP (B3 + B5)', () => {
  it('llega por STARTTLS con el enlace #token= intacto, HTML válido y el token fuera del asunto y de los registros', async () => {
    const smtp = await levantarServidorSmtp(certificado);
    const token = await conServidor(smtp, async () => {
      expect((await solicitar('e2@ejemplo.edu.co')).estado).toBe(202);
      await autenticacion.onApplicationShutdown();
      return tokenDe(smtp);
    });

    expect(smtp.recibidos).toHaveLength(1);
    expect(smtp.recibidos[0]?.seguro).toBe(true);
    const crudo = decodificarQuotedPrintable(smtp.recibidos[0]?.crudo ?? '');
    expect(token).toHaveLength(43);
    expect(crudo).toContain(
      `<a href="${URL_FRONTEND}/activar#token=${token}">${URL_FRONTEND}/activar#token=${token}</a>`,
    );
    const asunto = /^Subject: (.*)$/m.exec(crudo)?.[1] ?? '';
    expect(asunto).not.toBe('');
    expect(asunto).not.toContain(token);
    const html = crudo.slice(
      crudo.indexOf('<p>'),
      crudo.lastIndexOf('</p>') + 4,
    );
    expect(problemasHtml(html)).toEqual([]);
    expect(salida.lineas.join('\n')).not.toContain(token);

    // El enlace sirve: el token del correo activa la cuenta.
    const activar = await fetch(`${url}/acceso/activar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, contrasena: 'Contraseña-nueva-segura-1' }),
    });
    expect(activar.status).toBe(204);
  });

  it('el token no aparece en registros ni errores aunque el servidor lo devuelva al rechazar', async () => {
    let tokenRechazado = '';
    const smtp = await levantarServidorSmtp(certificado, {
      rechazarDatos: (crudo) => {
        tokenRechazado =
          PATRON_TOKEN.exec(decodificarQuotedPrintable(crudo))?.[1] ?? '';
        return { codigo: 550, texto: `Rechazado: token=${tokenRechazado}` };
      },
    });
    await conServidor(smtp, async () => {
      expect((await solicitar('e3@ejemplo.edu.co')).estado).toBe(202);
      await autenticacion.onApplicationShutdown();
    });

    expect(tokenRechazado).toHaveLength(43);
    const registro = salida.lineas.join('\n');
    expect(registro).toContain('Falló una solicitud de activación');
    expect(registro).not.toContain(tokenRechazado);
    expect(registro).not.toContain('e3@ejemplo.edu.co');
  });
});

describe('ajuste A: la respuesta no depende del envío', () => {
  it('la respuesta es idéntica con envío correcto, con envío fallido y con correo inexistente', async () => {
    const correcto = await levantarServidorSmtp(certificado);
    const ok = await conServidor(correcto, () =>
      solicitar('j1@ejemplo.edu.co'),
    );

    const rechazo = await levantarServidorSmtp(certificado, {
      rechazarDatos: () => ({ codigo: 550, texto: 'Rechazado' }),
    });
    const fallido = await conServidor(rechazo, () =>
      solicitar('ps1@ejemplo.edu.co'),
    );

    const vacio = await levantarServidorSmtp(certificado);
    const inexistente = await conServidor(vacio, () =>
      solicitar('nadie@ejemplo.edu.co'),
    );

    expect(correcto.recibidos).toHaveLength(1);
    expect(rechazo.recibidos).toHaveLength(0);
    expect(vacio.recibidos).toHaveLength(0);
    for (const otra of [fallido, inexistente]) {
      expect(otra.estado).toBe(ok.estado);
      expect(otra.cuerpo).toBe(ok.cuerpo);
      expect(otra.cabeceras).toEqual(ok.cabeceras);
    }
    expect(ok.estado).toBe(202);
  });

  it('con un servidor SMTP que no responde, la respuesta llega antes de que el envío termine', async () => {
    const mudo = await levantarServidorMudo(3000);
    const adaptador = proveedorPrueba(mudo.puerto, certificado);
    proveedor.actual = adaptador;
    try {
      const respuesta = await solicitar('d1@ejemplo.edu.co');
      expect(respuesta.estado).toBe(202);
      // El envío tardará el plazo completo (5 s); la respuesta, no.
      expect(respuesta.duracionMs).toBeLessThan(1000);

      const inicio = performance.now();
      await autenticacion.onApplicationShutdown();
      // Seguía en curso tras responder: terminó por el plazo global.
      expect(performance.now() - inicio).toBeGreaterThan(3000);
      expect(salida.lineas.join('\n')).toContain(
        'Falló una solicitud de activación',
      );
    } finally {
      adaptador.onModuleDestroy();
      proveedor.actual = null;
      await mudo.cerrar();
    }
  }, 20_000);
});
