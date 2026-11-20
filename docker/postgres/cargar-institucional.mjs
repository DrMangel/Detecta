// Carga el CSV institucional en una base de la lista permitida.
//
// Uso (desde back/): npm run bd:institucional [-- --base institucional_entrega
//   [--variante alternativa]] [--solo-validar]
// Sin --base se usa BD_INSTITUCIONAL_NOMBRE de back/.env. Ejecuta el .sql y el
// .csv correspondientes dentro del contenedor con `docker exec` (no recrea
// contenedores ni volúmenes), en una sola transacción.
//
// Guarda (respuesta 12 de Ivan; lista blanca de F5a): solo se aceptan
// institucional_demo e institucional_entrega; nunca una base de DETECTA.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONTENEDOR = 'detecta-postgres';
const SUPERUSUARIO = 'detecta_user';
const BASES_PERMITIDAS = new Set([
  'institucional_demo',
  'institucional_entrega',
]);

function argumentos(argv) {
  const opciones = { base: undefined, variante: 'tabla25', soloValidar: false };
  for (let indice = 0; indice < argv.length; indice += 1) {
    const argumento = argv[indice];
    if (argumento === '--solo-validar') {
      opciones.soloValidar = true;
      continue;
    }
    if (argumento !== '--base' && argumento !== '--variante') {
      throw new Error('Uso: bd:institucional [--base nombre] [--variante tabla25|alternativa] [--solo-validar]');
    }
    const valor = argv[indice + 1];
    if (!valor || valor.startsWith('--')) {
      throw new Error(`Falta el valor de ${argumento}`);
    }
    opciones[argumento === '--base' ? 'base' : 'variante'] = valor;
    indice += 1;
  }
  return opciones;
}

export function prepararCarga(argv, entorno) {
  const opciones = argumentos(argv);
  const base = opciones.base ?? entorno.BD_INSTITUCIONAL_NOMBRE?.trim();
  if (!BASES_PERMITIDAS.has(base)) {
    throw new Error(
      'Se rechaza la carga: solo se permiten institucional_demo e institucional_entrega.',
    );
  }
  if (!['tabla25', 'alternativa'].includes(opciones.variante)) {
    throw new Error('La variante debe ser tabla25 o alternativa.');
  }
  if (opciones.variante === 'alternativa' && base !== 'institucional_entrega') {
    throw new Error('La variante alternativa solo se permite en institucional_entrega.');
  }

  const demo = base === 'institucional_entrega';
  const sufijo = opciones.variante === 'alternativa' ? '-alternativa' : '';
  const prefijo = demo ? 'institucional_entrega' : 'institucional_demo';
  return {
    base,
    variante: opciones.variante,
    tabla: opciones.variante === 'alternativa'
      ? 'matricula_institucional_alternativa'
      : 'matricula_institucional',
    sql: `./${prefijo}${sufijo}.sql`,
    csv: `./${prefijo}${sufijo}.csv`,
    soloValidar: opciones.soloValidar,
  };
}

function cargar(argv = process.argv.slice(2), entorno = process.env) {
  let destino;
  try {
    destino = prepararCarga(argv, entorno);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Argumentos inválidos.');
    return 1;
  }
  if (destino.soloValidar) {
    console.log(`Configuración válida: ${destino.base} (${destino.variante}).`);
    return 0;
  }

  const leer = (nombre) =>
    readFileSync(fileURLToPath(new URL(nombre, import.meta.url)), 'utf8');
  const csv = leer(destino.csv).replace(/\r\n/g, '\n');
  const script = `${leer(destino.sql)}${csv.trimEnd()}\n\\.\nCOMMIT;\nSELECT count(*) AS filas_cargadas FROM ${destino.tabla};\n`;
  const resultado = spawnSync(
    'docker',
    [
      'exec', '-i', CONTENEDOR,
      'psql', '-U', SUPERUSUARIO, '-d', destino.base, '-v', 'ON_ERROR_STOP=1',
    ],
    { input: script, stdio: ['pipe', 'inherit', 'inherit'] },
  );
  if (resultado.error) {
    console.error(`No se pudo ejecutar docker: ${resultado.error.message}`);
    return 1;
  }
  return resultado.status ?? 1;
}

// Solo al ejecutarlo directamente; la prueba importa prepararCarga sin cargar.
if (import.meta.main) {
  process.exit(cargar());
}
