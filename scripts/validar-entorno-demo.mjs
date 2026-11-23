// Revisa demo/.env antes de preparar o iniciar la demostración (F5a) y,
// con --remoto, demo/.env.remoto antes de preparar las bases de Neon (F6).
//
// Uso (desde la raíz): node scripts/validar-entorno-demo.mjs [--remoto]
// Lo llaman scripts/preparar-demo.ps1, scripts/iniciar-demo.ps1 y
// scripts/preparar-remoto.ps1.
//
// `node --env-file` no reemplaza variables que ya existen en la sesión y
// ConfigModule completa con back/.env las que falten; cualquiera de los dos
// casos podría llevar la demo a las bases detecta o institucional_demo. Por
// eso se exigen todas las claves de demo/.env.example y ninguna variable de
// la sesión con otro valor. Los mensajes nunca muestran valores (ER 3.6.2).

import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const ESPERADOS = {
  PUERTO: '3000',
  URL_FRONTEND: 'http://localhost:5173',
  BD_DETECTA_NOMBRE: 'detecta_entrega',
  BD_INSTITUCIONAL_NOMBRE: 'institucional_entrega',
  CORREO_RECHAZAR_EJEMPLO_INVALID: 'true',
  CORREO_DESTINO_PERMITIDO: 'detectasoportetecnico+*@gmail.com',
};

// F6: herramientas locales contra Neon. TLS verificado, enlaces al front
// público y sin envío de correo desde la máquina local.
const ESPERADOS_REMOTO = {
  PGSSLMODE: 'verify-full',
  URL_FRONTEND: 'https://detecta-web.onrender.com',
  BD_DETECTA_NOMBRE: 'detecta_entrega',
  BD_INSTITUCIONAL_NOMBRE: 'institucional_entrega',
  CORREO_MODO: 'desactivado',
  CORREO_RECHAZAR_EJEMPLO_INVALID: 'true',
  CORREO_DESTINO_PERMITIDO: 'detectasoportetecnico+*@gmail.com',
};

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1']);

function esHostDirecto(host) {
  return Boolean(host) && !HOSTS_LOCALES.has(host) && !host.includes('-pooler');
}

function hostDeCadena(cadena) {
  try {
    const url = new URL(cadena ?? '');
    return ['postgres:', 'postgresql:'].includes(url.protocol) ? url.hostname : '';
  } catch {
    return '';
  }
}

export function revisarEntornoDemo(textoDemo, textoEjemplo, entornoSesion) {
  return revisar(parseEnv(textoDemo), textoEjemplo, entornoSesion, {
    esperados: ESPERADOS,
    archivo: 'demo/.env',
  });
}

// Los mensajes nombran la clave, nunca el host ni la cadena (ER 3.6.2).
export function revisarEntornoRemoto(textoRemoto, textoEjemplo, entornoSesion) {
  const remoto = parseEnv(textoRemoto);
  const errores = revisar(remoto, textoEjemplo, entornoSesion, {
    esperados: ESPERADOS_REMOTO,
    archivo: 'demo/.env.remoto',
  });
  for (const clave of ['BD_DETECTA_HOST', 'BD_INSTITUCIONAL_HOST']) {
    if (!esHostDirecto(remoto[clave]?.trim())) {
      errores.push(`${clave} debe ser el host directo de Neon (sin -pooler ni localhost).`);
    }
  }
  const hostDueno = hostDeCadena(remoto.NEON_CADENA_DUENO?.trim());
  if (!esHostDirecto(hostDueno)) {
    errores.push('NEON_CADENA_DUENO debe ser la cadena postgresql:// directa de Neon (sin -pooler).');
    return errores;
  }
  const hostDetecta = remoto.BD_DETECTA_HOST?.trim();
  if (esHostDirecto(hostDetecta) && hostDueno !== hostDetecta) {
    errores.push('NEON_CADENA_DUENO debe usar el mismo host directo que BD_DETECTA_HOST.');
  }
  return errores;
}

function revisar(demo, textoEjemplo, entornoSesion, { esperados, archivo }) {
  const errores = Object.entries(esperados)
    .filter(([clave, valor]) => demo[clave]?.trim() !== valor)
    .map(([clave, valor]) => `${clave} debe ser ${valor}.`);
  for (const clave of Object.keys(parseEnv(textoEjemplo))) {
    if (!(clave in demo)) {
      errores.push(`Falta ${clave} en ${archivo}.`);
    }
  }
  for (const [clave, valor] of Object.entries(demo)) {
    if (clave in entornoSesion && entornoSesion[clave] !== valor) {
      errores.push(
        `${clave} está definida en la sesión con otro valor; elimínese de la sesión antes de continuar.`,
      );
    }
  }
  return errores;
}

if (import.meta.main) {
  const leer = (nombre) =>
    readFileSync(new URL(`../demo/${nombre}`, import.meta.url), 'utf8');
  const remoto = process.argv.includes('--remoto');
  const archivo = remoto ? '.env.remoto' : '.env';
  let errores;
  try {
    errores = (remoto ? revisarEntornoRemoto : revisarEntornoDemo)(
      leer(archivo),
      leer(`${archivo}.example`),
      process.env,
    );
  } catch {
    errores = [`No se pudo leer demo/${archivo}; cópiese desde demo/${archivo}.example.`];
  }
  for (const error of errores) {
    console.error(error);
  }
  process.exit(errores.length === 0 ? 0 : 1);
}
