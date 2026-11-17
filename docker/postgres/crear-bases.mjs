// Ejecuta docker/postgres/crear-bases.sql dentro del contenedor de PostgreSQL.
//
// Uso (desde back/): npm run bd:crear
// Lee BD_APP_CONTRASENA y BD_LECTOR_CONTRASENA del .env de la raíz (node --env-file)
// y las pasa a psql como variables de entorno del proceso, no como argumentos,
// para que no aparezcan en la lista de procesos ni en el historial (ER 3.6.2).
// No recrea el contenedor ni el volumen: solo usa `docker exec`.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONTENEDOR = 'detecta-postgres';
const SUPERUSUARIO = 'detecta_user';

const faltantes = ['BD_APP_CONTRASENA', 'BD_LECTOR_CONTRASENA'].filter(
  (clave) => !process.env[clave]?.trim(),
);
if (faltantes.length > 0) {
  console.error(`Faltan variables en el .env de la raíz: ${faltantes.join(', ')}`);
  process.exit(1);
}

const sql = readFileSync(
  fileURLToPath(new URL('./crear-bases.sql', import.meta.url)),
  'utf8',
);

const resultado = spawnSync(
  'docker',
  [
    'exec', '-i',
    '-e', 'CLAVE_APP',
    '-e', 'CLAVE_LECTOR',
    CONTENEDOR,
    'sh', '-c',
    `psql -U ${SUPERUSUARIO} -d postgres -v ON_ERROR_STOP=1 -v clave_app="$CLAVE_APP" -v clave_lector="$CLAVE_LECTOR"`,
  ],
  {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: {
      ...process.env,
      CLAVE_APP: process.env.BD_APP_CONTRASENA,
      CLAVE_LECTOR: process.env.BD_LECTOR_CONTRASENA,
    },
  },
);

if (resultado.error) {
  console.error(`No se pudo ejecutar docker: ${resultado.error.message}`);
  process.exit(1);
}
process.exit(resultado.status ?? 1);
