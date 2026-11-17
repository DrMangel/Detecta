import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { DataSource } from 'typeorm';
import { Curso } from '../../src/dominio/entidades/curso';
import { Docente } from '../../src/dominio/entidades/docente';
import { Programa } from '../../src/dominio/entidades/programa';
import { ConectorBDConfigurable } from '../../src/integracion/conector-bd-configurable';
import {
  cargarConfiguracionConector,
  type ConfiguracionConector,
} from '../../src/integracion/configuracion-conector';
import type { Repositorios } from './escenario';
import './soporte';

/*
 * Soporte de las pruebas de sincronización (B4): lectura de
 * institucional_demo (cargada con `npm run bd:institucional`) como
 * institucional_lector, igual que la aplicación.
 */

/** Reloj fijo de las pruebas (ajuste B de Ivan): 2026-11-17 10:00 en Bogotá. */
export const AHORA_PRUEBAS = new Date('2026-11-17T15:00:00Z');

const RAIZ_BACK = join(__dirname, '..', '..');

export function configuracionEjemplo(): ConfiguracionConector {
  return cargarConfiguracionConector(
    join(RAIZ_BACK, 'conector-institucional.ejemplo.json'),
  );
}

/** Conexión del lector, como la conexión `institucional` de la aplicación. */
export function fuenteLector(
  cambios: { password?: string; port?: number } = {},
): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env['BD_INSTITUCIONAL_HOST'],
    port: cambios.port ?? Number(process.env['BD_INSTITUCIONAL_PUERTO']),
    database: process.env['BD_INSTITUCIONAL_NOMBRE'],
    username: process.env['BD_INSTITUCIONAL_USUARIO'],
    password: cambios.password ?? process.env['BD_INSTITUCIONAL_CONTRASENA'],
    entities: [],
    extra: {
      options: '-c default_transaction_read_only=on',
      connectionTimeoutMillis: 5000,
    },
  });
}

/**
 * Conexión del superusuario a institucional_demo, solo para VERIFICAR que la
 * sincronización no escribe nada (lee xmin de la tabla base, que el lector no
 * puede ver). Usa POSTGRES_PASSWORD del .env de la raíz.
 */
export async function abrirFuenteVerificacionInstitucional(): Promise<DataSource> {
  const raiz = parseEnv(
    readFileSync(join(RAIZ_BACK, '..', '.env'), 'utf8'),
  ) as Record<string, string>;
  const fuente = new DataSource({
    type: 'postgres',
    host: process.env['BD_INSTITUCIONAL_HOST'],
    port: Number(process.env['BD_INSTITUCIONAL_PUERTO']),
    database: 'institucional_demo',
    username: 'detecta_user',
    password: raiz['POSTGRES_PASSWORD'],
    entities: [],
  });
  await fuente.initialize();
  return fuente;
}

/** Huella del contenido y de las versiones de fila (xmin) de la tabla base. */
export async function huellaInstitucional(fuente: DataSource): Promise<string> {
  const [fila] = await fuente.query<{ huella: string }[]>(
    `SELECT md5(string_agg(m::text || '|' || m.xmin::text, ',' ORDER BY m.ctid)) AS huella
     FROM matricula_institucional m`,
  );
  return fila?.huella ?? '';
}

export function crearConector(
  fuente: DataSource,
  repos: Repositorios,
  configuracion = configuracionEjemplo(),
): ConectorBDConfigurable {
  return new ConectorBDConfigurable({
    fuente,
    configuracion,
    programas: repos.programas,
    cursos: repos.cursos,
    reloj: () => AHORA_PRUEBAS,
  });
}

/**
 * Configuración de DETECTA que corresponde al CSV: programas (con dos
 * nombres que normalizados coinciden, para la prueba de ambigüedad), el
 * docente con su correo y los cursos ISOF-101, CALC-201 y FIS-301.
 */
export async function configurarDetecta(repos: Repositorios): Promise<void> {
  for (const programa of [
    new Programa({ idPrograma: 'SIS', nombre: 'Ingeniería de Sistemas' }),
    new Programa({ idPrograma: 'QUI', nombre: 'Química' }),
    new Programa({ idPrograma: 'MUS1', nombre: 'Licenciatura en Música' }),
    new Programa({ idPrograma: 'MUS2', nombre: 'Licenciatura en musica' }),
  ]) {
    await repos.programas.guardar(programa);
  }
  const curso = (idCurso: string) =>
    new Curso({
      idCurso,
      nombre: idCurso,
      periodo: '2026-2',
      ultimaSincronizacion: null,
      estudiantes: [],
    });
  await repos.personas.guardar(
    new Docente({
      id: 'DOC-EJEMPLO',
      nombre: 'Docente de Ejemplo',
      correo: 'docente.ejemplo@ejemplo.invalid',
      contrasenaHash: '!SIN_ACTIVAR',
      cursos: [curso('ISOF-101'), curso('CALC-201'), curso('FIS-301')],
    }),
  );
}
