import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { maquina, reportar } from './soporte-carga';

/*
 * Verificación del ajuste 3a: UV_THREADPOOL_SIZE aplicado COMO LO HACE LA
 * APLICACIÓN. Cada medición es un proceso hijo con su propio directorio de
 * trabajo y su propio .env (solo esa clave; nunca se lee back/.env), que
 * carga dist/hilos-libuv.js, el mismo módulo que main.ts importa primero, y
 * luego hace 8 hashes bcrypt a la vez. Requiere `npm run build`.
 */

const MODULO = resolve(__dirname, '../../dist/hilos-libuv.js');
const BCRYPT = require.resolve('bcrypt');
const HASHES = 8;
const COSTO = 12;

const SCRIPT = `
require(${JSON.stringify(MODULO)});
const bcrypt = require(${JSON.stringify(BCRYPT)});
const inicio = performance.now();
Promise.all(Array.from({ length: ${HASHES} }, () => bcrypt.hash('x', ${COSTO})))
  .then(() => console.log(JSON.stringify({
    uv: process.env.UV_THREADPOOL_SIZE ?? null,
    ms: Math.round(performance.now() - inicio),
  })));
`;

function medir(contenidoEnv: string | null, externo?: string) {
  const directorio = mkdtempSync(join(tmpdir(), 'detecta-hilos-'));
  try {
    if (contenidoEnv !== null) {
      writeFileSync(join(directorio, '.env'), contenidoEnv);
    }
    const entorno: Record<string, string | undefined> = { ...process.env };
    delete entorno['UV_THREADPOOL_SIZE'];
    if (externo !== undefined) {
      entorno['UV_THREADPOOL_SIZE'] = externo;
    }
    const tiempos: number[] = [];
    let uv: string | null = null;
    for (let r = 0; r < 3; r++) {
      const salida = JSON.parse(
        execFileSync(process.execPath, ['-e', SCRIPT], {
          cwd: directorio,
          env: entorno,
          encoding: 'utf8',
        }),
      ) as { uv: string | null; ms: number };
      tiempos.push(salida.ms);
      uv = salida.uv;
    }
    tiempos.sort((a, b) => a - b);
    return { uvEnElProceso: uv, medianaMs: tiempos[1]!, tiempos };
  } finally {
    rmSync(directorio, { recursive: true, force: true });
  }
}

it('UV_THREADPOOL_SIZE desde el .env del directorio de trabajo, como main.ts', () => {
  expect(existsSync(MODULO)).toBe(true);
  const sinVariable = medir(null);
  const env8 = medir('PUERTO=3000\nUV_THREADPOOL_SIZE=8\n');
  const externo2 = medir('UV_THREADPOOL_SIZE=8\n', '2');
  reportar('HILOS_LIBUV', {
    ...maquina(),
    hashesSimultaneos: HASHES,
    costoBcrypt: COSTO,
    sinVariable,
    envCon8: env8,
    externo2ConEnv8: externo2,
  });

  expect(sinVariable.uvEnElProceso).toBeNull();
  expect(env8.uvEnElProceso).toBe('8');
  expect(externo2.uvEnElProceso).toBe('2');
  // Efecto real: con 8 hilos los 8 hashes no esperan turno (4 por defecto).
  expect(env8.medianaMs).toBeLessThan(sinVariable.medianaMs * 0.8);
  // Manda la variable externa: con 2 hilos tarda más que con 4.
  expect(externo2.medianaMs).toBeGreaterThan(sinVariable.medianaMs * 1.2);
}, 120_000);
