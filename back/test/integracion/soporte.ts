import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import type { DataSource, Logger } from 'typeorm';
import { ejecutarMigraciones } from '../../src/persistencia/ejecutar-migraciones';
import {
  crearFuenteDatosAplicacion,
  crearFuenteDatosMigrador,
} from '../../src/persistencia/fuente-datos';

/*
 * Soporte de las pruebas de integración (B2). Se ejecutan contra la base
 * `detecta_pruebas` del contenedor existente (no se recrea ni se elimina
 * ningún contenedor ni volumen):
 * - `detecta_migrador` aplica las migraciones y vacía las tablas entre pruebas.
 * - Las pruebas usan `detecta_app`, el mismo usuario sin DELETE de la app.
 */

// Jest da a cada archivo de pruebas su propia copia de process.env, y
// process.loadEnvFile escribe en el process.env real: por eso se lee el
// archivo y se asigna sobre la copia de esta suite.
Object.assign(
  process.env,
  parseEnv(readFileSync(join(__dirname, '..', '..', '.env'), 'utf8')),
);

export const BASE_PRUEBAS = process.env['BD_PRUEBAS_NOMBRE'] ?? '';

// Salvaguarda: nunca vaciar una base que no sea la de pruebas.
if (!BASE_PRUEBAS.endsWith('_pruebas')) {
  throw new Error(
    `BD_PRUEBAS_NOMBRE debe terminar en "_pruebas" (es "${BASE_PRUEBAS}")`,
  );
}

export const TABLAS = [
  'token_activacion',
  'evento_caso',
  'informe_riesgo_plan',
  'informe_riesgo_caso',
  'informe_riesgo',
  'plan_nivelacion_curso',
  'plan_nivelacion',
  'asesoria',
  'cita',
  'caso_riesgo',
  'origen_riesgo',
  'registro_academico',
  'curso',
  'persona',
  'programa',
] as const;

export async function migrarBasePruebas(): Promise<void> {
  await ejecutarMigraciones(BASE_PRUEBAS, 'migrar');
}

/** Vacía las tablas con el dueño del esquema (detecta_app no puede). */
export async function vaciarBasePruebas(): Promise<void> {
  const migrador = crearFuenteDatosMigrador(BASE_PRUEBAS);
  await migrador.initialize();
  try {
    await migrador.query(`TRUNCATE ${TABLAS.join(', ')}`);
  } finally {
    await migrador.destroy();
  }
}

/** Cuenta las consultas SQL que envía TypeORM (prueba de N+1). */
export class ContadorConsultas implements Logger {
  total = 0;
  logQuery(): void {
    this.total += 1;
  }
  logQueryError(): void {}
  logQuerySlow(): void {}
  logSchemaBuild(): void {}
  logMigration(): void {}
  log(): void {}
}

export async function abrirFuenteAplicacion(
  logger?: Logger,
): Promise<DataSource> {
  const fuente = crearFuenteDatosAplicacion(BASE_PRUEBAS, logger);
  await fuente.initialize();
  return fuente;
}
