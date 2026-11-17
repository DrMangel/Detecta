/**
 * Validación de las variables de entorno al arrancar (fase B0).
 *
 * Las credenciales solo llegan por variables de entorno, nunca en el código
 * (ER 3.6.2, OWASP Top 10). Si falta alguna o tiene un formato inválido la
 * aplicación no arranca y el mensaje lista todos los problemas a la vez.
 */

const ENTORNOS_PERMITIDOS = ['development', 'test', 'production'] as const;

export type EntornoEjecucion = (typeof ENTORNOS_PERMITIDOS)[number];

export interface VariablesEntorno {
  NODE_ENV: EntornoEjecucion;
  PUERTO: number;
  BD_DETECTA_HOST: string;
  BD_DETECTA_PUERTO: number;
  BD_DETECTA_NOMBRE: string;
  BD_DETECTA_USUARIO: string;
  BD_DETECTA_CONTRASENA: string;
  BD_INSTITUCIONAL_HOST: string;
  BD_INSTITUCIONAL_PUERTO: number;
  BD_INSTITUCIONAL_NOMBRE: string;
  BD_INSTITUCIONAL_USUARIO: string;
  BD_INSTITUCIONAL_CONTRASENA: string;
  /** Secreto de firma del JWT de sesión (HS256), de al menos 32 caracteres (B3). */
  JWT_SECRETO: string;
  /** Duración fija de la sesión en minutos (D14: 60, sin valor por defecto). */
  SESION_DURACION_MIN: number;
  /** Atributo Secure de la cookie de sesión; en producción debe ser true. */
  COOKIE_SEGURA: boolean;
  /** Costo de bcrypt (ER 3.6.2; aprobado 12). */
  BCRYPT_COSTO: number;
  /** Vida del token de activación en minutos (D16: 30). */
  ACTIVACION_DURACION_MIN: number;
  /** Origen del frontend: enlace de activación y CORS (sin comodines). */
  URL_FRONTEND: string;
}

type ClaveTexto = {
  [K in keyof VariablesEntorno]: VariablesEntorno[K] extends string ? K : never;
}[keyof VariablesEntorno];

/** Enteros con su rango permitido. */
const ENTEROS = {
  SESION_DURACION_MIN: [1, 1440],
  ACTIVACION_DURACION_MIN: [1, 1440],
  BCRYPT_COSTO: [10, 15],
} as const;

type ClaveEntero = keyof typeof ENTEROS;

const LONGITUD_MINIMA_SECRETO = 32;

type ClavePuerto = 'PUERTO' | 'BD_DETECTA_PUERTO' | 'BD_INSTITUCIONAL_PUERTO';

const CLAVES_TEXTO: readonly Exclude<
  ClaveTexto,
  'NODE_ENV' | 'URL_FRONTEND'
>[] = [
  'BD_DETECTA_HOST',
  'BD_DETECTA_NOMBRE',
  'BD_DETECTA_USUARIO',
  'BD_DETECTA_CONTRASENA',
  'BD_INSTITUCIONAL_HOST',
  'BD_INSTITUCIONAL_NOMBRE',
  'BD_INSTITUCIONAL_USUARIO',
  'BD_INSTITUCIONAL_CONTRASENA',
  'JWT_SECRETO',
];

const CLAVES_PUERTO: readonly ClavePuerto[] = [
  'PUERTO',
  'BD_DETECTA_PUERTO',
  'BD_INSTITUCIONAL_PUERTO',
];

function leerTexto(valor: unknown): string | undefined {
  if (typeof valor !== 'string') {
    return undefined;
  }
  const recortado = valor.trim();
  return recortado === '' ? undefined : recortado;
}

/**
 * Función `validate` para `ConfigModule.forRoot`. Recibe las variables crudas
 * (texto) y devuelve las variables tipadas o lanza un error con todos los
 * problemas encontrados.
 */
export function validarEntorno(
  crudas: Record<string, unknown>,
): VariablesEntorno {
  const errores: string[] = [];

  const nodeEnv = leerTexto(crudas['NODE_ENV']);
  if (
    nodeEnv === undefined ||
    !(ENTORNOS_PERMITIDOS as readonly string[]).includes(nodeEnv)
  ) {
    errores.push(`NODE_ENV debe ser uno de: ${ENTORNOS_PERMITIDOS.join(', ')}`);
  }

  const textos: Partial<Record<ClaveTexto, string>> = {};
  for (const clave of CLAVES_TEXTO) {
    const valor = leerTexto(crudas[clave]);
    if (valor === undefined) {
      errores.push(`${clave} es obligatoria`);
    } else {
      textos[clave] = valor;
    }
  }

  const puertos: Partial<Record<ClavePuerto, number>> = {};
  for (const clave of CLAVES_PUERTO) {
    const valor = leerTexto(crudas[clave]);
    const numero = valor === undefined ? Number.NaN : Number(valor);
    if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
      errores.push(`${clave} debe ser un entero entre 1 y 65535`);
    } else {
      puertos[clave] = numero;
    }
  }

  const secreto = textos.JWT_SECRETO;
  if (secreto !== undefined && secreto.length < LONGITUD_MINIMA_SECRETO) {
    errores.push(
      `JWT_SECRETO debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres`,
    );
  }

  const enteros: Partial<Record<ClaveEntero, number>> = {};
  for (const [clave, [minimo, maximo]] of Object.entries(ENTEROS) as [
    ClaveEntero,
    readonly [number, number],
  ][]) {
    const valor = leerTexto(crudas[clave]);
    const numero = valor === undefined ? Number.NaN : Number(valor);
    if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
      errores.push(`${clave} debe ser un entero entre ${minimo} y ${maximo}`);
    } else {
      enteros[clave] = numero;
    }
  }

  const cookieSegura = leerTexto(crudas['COOKIE_SEGURA']);
  if (cookieSegura !== 'true' && cookieSegura !== 'false') {
    errores.push('COOKIE_SEGURA debe ser true o false');
  } else if (nodeEnv === 'production' && cookieSegura !== 'true') {
    // Manual 4.1.1.5: la cookie viaja con Secure; solo en desarrollo local
    // puede desactivarse (p. ej. acceso por IP sin HTTPS).
    errores.push('COOKIE_SEGURA debe ser true en producción');
  }

  // URL_FRONTEND se normaliza a su origen exacto (esquema, host y puerto):
  // es el único origen admitido por CORS, sin comodines.
  let origenFrontend: string | undefined;
  const urlFrontend = leerTexto(crudas['URL_FRONTEND']);
  try {
    const url = new URL(urlFrontend ?? '');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('protocolo');
    }
    origenFrontend = url.origin;
  } catch {
    errores.push('URL_FRONTEND debe ser una URL http(s) válida');
  }

  if (errores.length > 0) {
    throw new Error(
      `Variables de entorno inválidas:\n- ${errores.join('\n- ')}`,
    );
  }

  return {
    ...(textos as Record<Exclude<ClaveTexto, 'URL_FRONTEND'>, string>),
    ...(puertos as Record<ClavePuerto, number>),
    ...(enteros as Record<ClaveEntero, number>),
    COOKIE_SEGURA: cookieSegura === 'true',
    URL_FRONTEND: origenFrontend as string,
    NODE_ENV: nodeEnv as EntornoEjecucion,
  };
}
