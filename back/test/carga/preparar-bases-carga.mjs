// Prepara las bases de medición de B9 (ajuste G de Ivan): detecta_carga e
// institucional_carga, con datos sintéticos. No usa contraseñas: los roles ya
// existen (npm run bd:crear) y se ejecuta como superusuario del contenedor,
// igual que docker/postgres/crear-bases.mjs.
//
// Uso (desde back/): npm run carga:preparar
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONTENEDOR = 'detecta-postgres';
const SUPERUSUARIO = 'detecta_user';

const sql = readFileSync(
  fileURLToPath(new URL('./preparar-bases-carga.sql', import.meta.url)),
  'utf8',
);
for (const base of sql.matchAll(/CREATE DATABASE (\w+)/g)) {
  if (!base[1].endsWith('_carga')) {
    console.error(`Se rechaza: la base "${base[1]}" no termina en _carga.`);
    process.exit(1);
  }
}

const resultado = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    CONTENEDOR,
    'psql',
    '-U',
    SUPERUSUARIO,
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  { input: sql, stdio: ['pipe', 'inherit', 'inherit'] },
);
if (resultado.error) {
  console.error(`No se pudo ejecutar docker: ${resultado.error.message}`);
  process.exit(1);
}
process.exit(resultado.status ?? 1);
