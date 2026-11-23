// Lanza la sincronización contra el enlace público (F6, verificación g):
// POST /api/sincronizacion con Authorization: Bearer <SINCRONIZACION_SECRETO>
// (B4). El secreto se lee de demo/.env.remoto y nunca se imprime (ER 3.6.2).
//
// Uso (desde la raíz): node scripts/sincronizar-remoto.mjs

import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const entorno = parseEnv(
  readFileSync(new URL('../demo/.env.remoto', import.meta.url), 'utf8'),
);
const inicio = performance.now();
const respuesta = await fetch(`${entorno.URL_FRONTEND}/api/sincronizacion`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${entorno.SINCRONIZACION_SECRETO}` },
});
const milisegundos = Math.round(performance.now() - inicio);
console.log(`HTTP ${respuesta.status} en ${milisegundos} ms`);
console.log(JSON.stringify(await respuesta.json(), null, 2));
process.exitCode = respuesta.ok ? 0 : 1;
