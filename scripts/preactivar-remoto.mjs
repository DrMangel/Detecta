// Preactiva las cuentas que usará el evaluador (F6, decisión J8): una por rol
// y dos de estudiante (adulto y menor). Usa el flujo real de D6, sin tocar la
// base a mano:
//   1. `datos-iniciales --enlace <correo>` contra Neon (demo/.env.remoto)
//      emite un enlace de un solo uso; su salida se lee en memoria;
//   2. POST /api/acceso/activar en el enlace público con una contraseña
//      aleatoria;
//   3. POST /api/acceso/iniciar-sesion para comprobarla y medir el tiempo
//      (decisión J7).
// Las contraseñas se guardan solo en %USERPROFILE%\detecta-entrega\, nunca se
// imprimen ni se versionan. Cada ejecución las renueva todas.
// Las cuentas (rol, nombre y correo) se leen de los mismos datos que cargan
// las bases (demo/datos-iniciales.ejemplo.json e institucional_entrega.csv):
// el script no tiene correos escritos a mano (datos de la demostración).
//
// Uso (desde la raíz, con la sincronización ya hecha):
//   node scripts/preactivar-remoto.mjs

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { leerCsv } from '../docker/postgres/datos-entrega.mjs';

const BACK = fileURLToPath(new URL('../back/', import.meta.url));
const CARPETA = join(homedir(), 'detecta-entrega');
const ARCHIVO = join(CARPETA, 'cuentas-evaluador.txt');
const PERSONAL = ['DOCENTE', 'JEFE_DEPARTAMENTO', 'PSICOLOGO'];
// Ficticios: 2026001 nació en 2002 y 2026005 en 2012 (menor de edad).
const ESTUDIANTES = [
  ['2026001', 'ESTUDIANTE (adulto, 2026001)'],
  ['2026005', 'ESTUDIANTE (menor de edad, 2026005)'],
];

/** Las cinco cuentas del evaluador, con rol, nombre y correo de los datos. */
export function cuentasEvaluador() {
  const datos = JSON.parse(readFileSync(new URL('../demo/datos-iniciales.ejemplo.json', import.meta.url), 'utf8'));
  const filas = leerCsv(new URL('../docker/postgres/institucional_entrega.csv', import.meta.url));
  const personal = PERSONAL.map((rol) => {
    const { nombre, correo } = datos.usuarios.find((usuario) => usuario.rol === rol);
    return { rol, nombre, correo };
  });
  const estudiantes = ESTUDIANTES.map(([id, rol]) => {
    const fila = filas.find((f) => f.id_estudiante === id);
    return { rol, nombre: fila.nombre_estudiante, correo: fila.correo_estudiante };
  });
  return [...personal, ...estudiantes];
}

/** Línea de cuentas-evaluador.txt: rol | nombre | correo | contraseña. */
export function lineaCuenta(cuenta, contrasena) {
  return `${cuenta.rol} | ${cuenta.nombre} | ${cuenta.correo} | ${contrasena}`;
}

/** Extrae el token del enlace `${URL_FRONTEND}/activar#token=...`. */
export function tokenDeSalida(salida) {
  const coincidencia = /\/activar#token=([A-Za-z0-9_-]+)/.exec(salida);
  if (!coincidencia) {
    throw new Error('La salida de datos-iniciales no trae un enlace de activación.');
  }
  return coincidencia[1];
}

function emitirToken(correo) {
  const resultado = spawnSync(
    process.execPath,
    ['--env-file=../demo/.env.remoto', 'dist/comandos/datos-iniciales.js', '--enlace', correo],
    { cwd: BACK, encoding: 'utf8' },
  );
  if (resultado.status !== 0) {
    throw new Error(`No se pudo emitir el enlace de ${correo}.`);
  }
  return tokenDeSalida(resultado.stdout);
}

async function enviar(urlBase, ruta, cuerpo) {
  const inicio = performance.now();
  const respuesta = await fetch(`${urlBase}/api/acceso/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return { estado: respuesta.status, ms: Math.round(performance.now() - inicio), respuesta };
}

async function preactivar(urlBase, cuenta) {
  const contrasena = randomBytes(18).toString('base64url');
  const activacion = await enviar(urlBase, 'activar', { token: emitirToken(cuenta.correo), contrasena });
  if (activacion.estado !== 204) {
    throw new Error(`Activación de ${cuenta.correo}: HTTP ${activacion.estado}.`);
  }
  const sesion = await enviar(urlBase, 'iniciar-sesion', { correo: cuenta.correo, contrasena });
  const rol = sesion.estado === 200 ? (await sesion.respuesta.json()).rol : '-';
  console.log(`${cuenta.rol}: activar ${activacion.estado}; iniciar sesión ${sesion.estado} (rol ${rol}) en ${sesion.ms} ms`);
  return lineaCuenta(cuenta, contrasena);
}

if (import.meta.main) {
  const entorno = parseEnv(readFileSync(new URL('../demo/.env.remoto', import.meta.url), 'utf8'));
  const lineas = [
    '# Cuentas de demostración de DETECTA (datos ficticios). No versionar ni publicar.',
    '# rol | nombre | correo | contraseña',
  ];
  try {
    for (const cuenta of cuentasEvaluador()) {
      lineas.push(await preactivar(entorno.URL_FRONTEND, cuenta));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Error inesperado.');
    process.exitCode = 1;
  } finally {
    mkdirSync(CARPETA, { recursive: true });
    writeFileSync(ARCHIVO, `${lineas.join('\n')}\n`);
    console.log(`Cuentas guardadas (no mostrar ni versionar): ${ARCHIVO}`);
  }
}
