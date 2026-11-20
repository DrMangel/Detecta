// Revisa demo/.env antes de preparar o iniciar la demostración (F5a).
//
// Uso (desde la raíz): node scripts/validar-entorno-demo.mjs
// Lo llaman scripts/preparar-demo.ps1 y scripts/iniciar-demo.ps1.
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

export function revisarEntornoDemo(textoDemo, textoEjemplo, entornoSesion) {
  const demo = parseEnv(textoDemo);
  const errores = Object.entries(ESPERADOS)
    .filter(([clave, valor]) => demo[clave]?.trim() !== valor)
    .map(([clave, valor]) => `${clave} debe ser ${valor}.`);
  for (const clave of Object.keys(parseEnv(textoEjemplo))) {
    if (!(clave in demo)) {
      errores.push(`Falta ${clave} en demo/.env.`);
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
  let errores;
  try {
    errores = revisarEntornoDemo(
      leer('.env'),
      leer('.env.example'),
      process.env,
    );
  } catch {
    errores = ['No se pudo leer demo/.env; cópiese desde demo/.env.example.'];
  }
  for (const error of errores) {
    console.error(error);
  }
  process.exit(errores.length === 0 ? 0 : 1);
}
