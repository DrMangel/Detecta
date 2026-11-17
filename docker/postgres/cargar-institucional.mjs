// Carga la base institucional emulada (institucional_demo) desde el CSV.
//
// Uso (desde back/): npm run bd:institucional
// Ejecuta institucional_demo.sql + institucional_demo.csv dentro del
// contenedor con `docker exec` (no recrea contenedores ni volúmenes), en una
// sola transacción.
//
// Guarda (respuesta 12 de Ivan): se niega a correr si la base destino, tomada
// de BD_INSTITUCIONAL_NOMBRE en back/.env, no es institucional_demo.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONTENEDOR = 'detecta-postgres';
const SUPERUSUARIO = 'detecta_user';
const BASE_PERMITIDA = 'institucional_demo';

const destino = process.env.BD_INSTITUCIONAL_NOMBRE?.trim();
if (destino !== BASE_PERMITIDA) {
  console.error(
    `Se rechaza la carga: la base destino es "${destino ?? ''}" y solo se permite "${BASE_PERMITIDA}".`,
  );
  process.exit(1);
}

const leer = (nombre) =>
  readFileSync(fileURLToPath(new URL(nombre, import.meta.url)), 'utf8');
const csv = leer('./institucional_demo.csv').replace(/\r\n/g, '\n');
const script = `${leer('./institucional_demo.sql')}${csv.trimEnd()}\n\\.\nCOMMIT;\nSELECT count(*) AS filas_cargadas FROM matricula_institucional;\n`;

const resultado = spawnSync(
  'docker',
  [
    'exec', '-i', CONTENEDOR,
    'psql', '-U', SUPERUSUARIO, '-d', BASE_PERMITIDA, '-v', 'ON_ERROR_STOP=1',
  ],
  { input: script, stdio: ['pipe', 'inherit', 'inherit'] },
);

if (resultado.error) {
  console.error(`No se pudo ejecutar docker: ${resultado.error.message}`);
  process.exit(1);
}
process.exit(resultado.status ?? 1);
