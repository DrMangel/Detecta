// Lectura de los datos de la demostración (institucional_entrega.csv) y
// regla de alias de sus correos. La usan scripts/preactivar-remoto.mjs y la
// prueba de coherencia datos-entrega.spec.mjs.
//
// Regla de alias (decisión de Ivan, datos de la demostración): cada persona
// tiene el alias <cuenta de soporte>+<nombre>.<apellido1>@<dominio>, en
// minúsculas, sin tildes ni dígitos, derivado de su nombre. Así cumple
// CORREO_DESTINO_PERMITIDO y el correo se reconoce por el nombre. El inicio
// de sesión distingue mayúsculas en el correo: por eso todo va en minúsculas.
import { readFileSync } from 'node:fs';

/** Filas del CSV como objetos; todos los campos van entre comillas dobles. */
export function leerCsv(ruta) {
  const [cabecera, ...lineas] = readFileSync(ruta, 'utf8')
    .replace(/\r\n/g, '\n')
    .trimEnd()
    .split('\n')
    .map(camposDeLinea);
  return lineas.map((campos) =>
    Object.fromEntries(cabecera.map((nombre, i) => [nombre, campos[i]])),
  );
}

function camposDeLinea(linea) {
  return [...linea.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'));
}

/** Palabras del nombre en minúsculas, sin tildes, con ñ como n y solo letras. */
function palabras(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .map((palabra) => palabra.replace(/[^a-z]/g, ''))
    .filter(Boolean);
}

/**
 * Sufijo del alias: <nombre>.<apellido1>. Con cuatro palabras o más se
 * entiende «nombre nombre2 apellido1 apellido2»; con tres, «nombre apellido1
 * apellido2»; con menos, las que haya.
 */
export function aliasDeNombre(nombre) {
  const p = palabras(nombre);
  const apellido1 = p.length >= 4 ? p.at(-2) : p[1];
  return [p[0], apellido1].filter(Boolean).join('.');
}
