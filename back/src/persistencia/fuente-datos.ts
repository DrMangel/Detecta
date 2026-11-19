import { DataSource, type DataSourceOptions, type Logger } from 'typeorm';
import { ESQUEMAS } from './esquemas';
import { EsquemaInicial1794873600000 } from './migraciones/1794873600000-EsquemaInicial';
import { TokensActivacion1794877200000 } from './migraciones/1794877200000-TokensActivacion';
import { TrazabilidadCaso1794880800000 } from './migraciones/1794880800000-TrazabilidadCaso';
import { AutoriaInforme1794884400000 } from './migraciones/1794884400000-AutoriaInforme';
import { EventosCaso1794888000000 } from './migraciones/1794888000000-EventosCaso';

/** Migraciones en orden. Se listan explícitamente (sin glob) para que
 * funcionen igual desde `dist/` y desde las pruebas con ts-jest. */
export const MIGRACIONES = [
  EsquemaInicial1794873600000,
  TokensActivacion1794877200000,
  TrazabilidadCaso1794880800000,
  AutoriaInforme1794884400000,
  EventosCaso1794888000000,
];

function exigirVariable(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
}

function puerto(nombre: string): number {
  const valor = Number(exigirVariable(nombre));
  if (!Number.isInteger(valor) || valor < 1 || valor > 65535) {
    throw new Error(`${nombre} debe ser un entero entre 1 y 65535`);
  }
  return valor;
}

/**
 * Conexión del dueño del esquema (`detecta_migrador`) para ejecutar las
 * migraciones. Nunca la usa la aplicación.
 */
export function crearFuenteDatosMigrador(nombreBase: string): DataSource {
  return new DataSource({
    type: 'postgres',
    host: exigirVariable('BD_DETECTA_HOST'),
    port: puerto('BD_DETECTA_PUERTO'),
    database: nombreBase,
    username: exigirVariable('BD_MIGRADOR_USUARIO'),
    password: exigirVariable('BD_MIGRADOR_CONTRASENA'),
    entities: [],
    migrations: MIGRACIONES,
    migrationsTableName: 'migraciones_typeorm',
    synchronize: false,
  });
}

/**
 * Conexión con el usuario de la aplicación (`detecta_app`) a la base
 * indicada. La usan las pruebas de integración contra `detecta_pruebas`;
 * la aplicación usa la configuración equivalente de `app.module.ts`.
 */
export function crearFuenteDatosAplicacion(
  nombreBase: string,
  logger?: Logger,
): DataSource {
  const opciones: DataSourceOptions = {
    type: 'postgres',
    host: exigirVariable('BD_DETECTA_HOST'),
    port: puerto('BD_DETECTA_PUERTO'),
    database: nombreBase,
    username: exigirVariable('BD_DETECTA_USUARIO'),
    password: exigirVariable('BD_DETECTA_CONTRASENA'),
    entities: ESQUEMAS,
    synchronize: false,
    ...(logger ? { logger, logging: true } : {}),
  };
  return new DataSource(opciones);
}
