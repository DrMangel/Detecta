import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/*
 * Tamaño del conjunto de hilos de libuv (fase B9, sub-etapa 4; ajuste 3a de
 * Ivan). bcrypt (ER 3.6.2) hace el hash en ese conjunto: con el valor por
 * defecto (4) los inicios de sesión simultáneos se encolan de 4 en 4.
 *
 * libuv lee UV_THREADPOOL_SIZE una sola vez, la primera vez que usa el
 * conjunto. Por eso este módulo es la PRIMERA importación de main.ts: corre
 * antes de que Nest cargue back/.env, que llegaría tarde. Si la variable ya
 * viene del entorno externo, manda esa (igual que con el resto de variables:
 * dotenv no sobrescribe el entorno). Si no, se toma SOLO esta clave de .env;
 * el resto del archivo no se toca ni se registra.
 *
 * Un valor inválido no se aplica: validarEntorno lo rechaza y la aplicación
 * no arranca.
 */

export const HILOS_LIBUV_MINIMO = 1;
export const HILOS_LIBUV_MAXIMO = 128;
export const HILOS_LIBUV_POR_DEFECTO = 4;

/** true si el texto es un entero dentro del rango admitido. */
export function hilosLibuvValido(valor: string): boolean {
  const numero = Number(valor.trim());
  return (
    valor.trim() !== '' &&
    Number.isInteger(numero) &&
    numero >= HILOS_LIBUV_MINIMO &&
    numero <= HILOS_LIBUV_MAXIMO
  );
}

/**
 * Valor que hay que fijar en process.env, o null si no hay que fijar nada
 * (ya viene del entorno externo, no está en .env o es inválido).
 */
export function resolverHilosLibuv(
  entorno: Readonly<Record<string, string | undefined>>,
  leerArchivoEnv: () => string | null,
): string | null {
  const externo = entorno['UV_THREADPOOL_SIZE'];
  if (externo !== undefined) {
    // Vacía cuenta como no declarada (validarEntorno usa 4), pero libuv la
    // leería como 0 y usaría 1 hilo: se fija el valor por defecto.
    return externo.trim() === '' ? String(HILOS_LIBUV_POR_DEFECTO) : null;
  }
  const contenido = leerArchivoEnv();
  if (contenido === null) {
    return null;
  }
  const valor = parseEnv(contenido)['UV_THREADPOOL_SIZE'];
  // Vacía o ausente en .env no hace falta fijarla: @nestjs/config escribe en
  // process.env el valor ya validado (4), no el texto vacío.
  return valor !== undefined && hilosLibuvValido(valor) ? valor.trim() : null;
}

function leerEnvDelDirectorioActual(): string | null {
  try {
    // Mismo archivo que ConfigModule (envFilePath '.env', relativo al cwd).
    return readFileSync('.env', 'utf8');
  } catch {
    return null;
  }
}

const valor = resolverHilosLibuv(process.env, leerEnvDelDirectorioActual);
if (valor !== null) {
  process.env['UV_THREADPOOL_SIZE'] = valor;
}
