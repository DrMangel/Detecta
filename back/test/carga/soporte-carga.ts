import { cpus, totalmem, platform, release } from 'node:os';
import { DataSource, type Logger } from 'typeorm';
import { ejecutarMigraciones } from '../../src/persistencia/ejecutar-migraciones';
import {
  crearFuenteDatosAplicacion,
  crearFuenteDatosMigrador,
} from '../../src/persistencia/fuente-datos';
import { TABLAS } from '../integracion/soporte';

/*
 * Soporte de las mediciones de B9 (ajuste G de Ivan). Solo bases cuyo
 * nombre termina en "_carga", con datos sintéticos; fuera de `npm test`.
 * Las cifras locales NO equivalen a producción.
 */

export const BASE_CARGA = 'detecta_carga';
export const BASE_INSTITUCIONAL_CARGA = 'institucional_carga';

for (const base of [BASE_CARGA, BASE_INSTITUCIONAL_CARGA]) {
  if (!base.endsWith('_carga')) {
    throw new Error(`Se rechaza: la base "${base}" no termina en _carga`);
  }
}

export async function migrarBaseCarga(): Promise<void> {
  await ejecutarMigraciones(BASE_CARGA, 'migrar');
}

export async function vaciarBaseCarga(): Promise<void> {
  const migrador = crearFuenteDatosMigrador(BASE_CARGA);
  await migrador.initialize();
  try {
    await migrador.query(`TRUNCATE ${TABLAS.join(', ')} CASCADE`);
  } finally {
    await migrador.destroy();
  }
}

export async function abrirFuenteCarga(logger?: Logger): Promise<DataSource> {
  const fuente = crearFuenteDatosAplicacion(BASE_CARGA, logger);
  await fuente.initialize();
  return fuente;
}

/** Lector de la base institucional de carga (solo lectura, como en B4). */
export function fuenteLectorCarga(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env['BD_INSTITUCIONAL_HOST'],
    port: Number(process.env['BD_INSTITUCIONAL_PUERTO']),
    database: BASE_INSTITUCIONAL_CARGA,
    username: process.env['BD_INSTITUCIONAL_USUARIO'],
    password: process.env['BD_INSTITUCIONAL_CONTRASENA'],
    entities: [],
    extra: { options: '-c default_transaction_read_only=on' },
  });
}

/** Estadística de una serie de tiempos en milisegundos. */
export function estadistica(tiempos: readonly number[]) {
  const orden = [...tiempos].sort((a, b) => a - b);
  const percentil = (p: number) =>
    orden[
      Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)
    ] ?? 0;
  return {
    n: orden.length,
    p50: Math.round(percentil(50)),
    p95: Math.round(percentil(95)),
    max: Math.round(orden.at(-1) ?? 0),
  };
}

/** Características de la máquina (ajuste G). */
export function maquina() {
  const nucleos = cpus();
  return {
    so: `${platform()} ${release()}`,
    cpu: nucleos[0]?.model ?? 'desconocida',
    nucleosLogicos: nucleos.length,
    memoriaGB: Math.round(totalmem() / 1024 ** 3),
    node: process.version,
    uvThreadpoolSize: process.env['UV_THREADPOOL_SIZE'] ?? '4 (por defecto)',
  };
}

/** Escribe una medición en una línea (sin datos personales). */
export function reportar(id: string, datos: Record<string, unknown>): void {
  process.stdout.write(`MEDICION ${JSON.stringify({ id, ...datos })}\n`);
}
