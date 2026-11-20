/**
 * Validación de las variables de entorno al arrancar (fase B0).
 *
 * Las credenciales solo llegan por variables de entorno, nunca en el código
 * (ER 3.6.2, OWASP Top 10). Si falta alguna o tiene un formato inválido la
 * aplicación no arranca y el mensaje lista todos los problemas a la vez.
 */

import {
  HILOS_LIBUV_MAXIMO,
  HILOS_LIBUV_MINIMO,
  HILOS_LIBUV_POR_DEFECTO,
} from './hilos-libuv';

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
  /** Ruta del JSON con el origen y el mapeo de campos del conector (B4). */
  CONECTOR_CONFIGURACION: string;
  /** Hora HH:MM (Bogotá) de la sincronización nocturna; null la desactiva. */
  SINCRONIZACION_HORA_NOCTURNA: string | null;
  /** Secreto del disparo manual por HTTP (≥32); null desactiva la ruta. */
  SINCRONIZACION_SECRETO: string | null;
  /** Correo saliente (B5): SMTP con Brevo, o desactivado explícitamente. */
  CORREO: ConfiguracionCorreoEntorno;
  /** Bloquea dominios de ejemplo al enviar desde el entorno de demostración. */
  CORREO_RECHAZAR_EJEMPLO_INVALID: boolean;
  /**
   * Patrón de destinatarios admitidos en demostración (F5a), p. ej.
   * `detectasoportetecnico+*@gmail.com`; null no restringe.
   */
  CORREO_DESTINO_PERMITIDO: string | null;
  /**
   * Hilos de libuv (B9, ajuste 3a): opcional, 4 por defecto. Se valida aquí,
   * pero lo aplica hilos-libuv.ts al arrancar, antes de cargar este módulo.
   */
  UV_THREADPOOL_SIZE: number;
  /** Conexiones máximas del pool de la base detecta (B9, ajuste 3b): opcional. */
  BD_DETECTA_POOL_MAX: number;
  /**
   * Espera máxima por una conexión libre del pool, en ms (B9, condición 4 del
   * informe parcial 2): opcional, 10000 por defecto. Al vencer, la petición
   * responde 503 en lugar de quedar en cola sin límite.
   */
  BD_DETECTA_CONEXION_ESPERA_MS: number;
}

/**
 * B5 (respuesta 4 de Ivan): sin configuración SMTP la aplicación no arranca,
 * salvo `CORREO_MODO=desactivado`, que se rechaza en producción.
 */
export type ConfiguracionCorreoEntorno =
  | { modo: 'desactivado' }
  | {
      modo: 'smtp';
      host: string;
      puerto: number;
      usuario: string;
      /** Clave SMTP de Brevo: secreto, nunca se registra. */
      clave: string;
      remitente: string;
      remitenteNombre: string;
    };

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ClaveTexto = {
  [K in keyof VariablesEntorno]: VariablesEntorno[K] extends string ? K : never;
}[keyof VariablesEntorno];

/** HH:MM de 00:00 a 23:59. */
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Enteros con su rango permitido. */
const ENTEROS = {
  SESION_DURACION_MIN: [1, 1440],
  ACTIVACION_DURACION_MIN: [1, 1440],
  BCRYPT_COSTO: [10, 15],
} as const;

type ClaveEntero = keyof typeof ENTEROS;

/**
 * Enteros opcionales (B9): [mínimo, máximo, valor por defecto]. El tope del
 * pool queda por debajo de max_connections de PostgreSQL (100 por defecto).
 */
const ENTEROS_OPCIONALES = {
  UV_THREADPOOL_SIZE: [
    HILOS_LIBUV_MINIMO,
    HILOS_LIBUV_MAXIMO,
    HILOS_LIBUV_POR_DEFECTO,
  ],
  BD_DETECTA_POOL_MAX: [1, 50, 10],
  // Finita a propósito (0 sería espera infinita en pg); el tope coincide con
  // headersTimeout (60 s).
  BD_DETECTA_CONEXION_ESPERA_MS: [1000, 60000, 10000],
} as const;

type ClaveEnteroOpcional = keyof typeof ENTEROS_OPCIONALES;

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
  'CONECTOR_CONFIGURACION',
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

  const opcionales: Partial<Record<ClaveEnteroOpcional, number>> = {};
  for (const [clave, [minimo, maximo, porDefecto]] of Object.entries(
    ENTEROS_OPCIONALES,
  ) as [ClaveEnteroOpcional, readonly [number, number, number]][]) {
    const valor = leerTexto(crudas[clave]);
    const numero = valor === undefined ? porDefecto : Number(valor);
    if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
      errores.push(
        `${clave} es opcional; si se declara debe ser un entero entre ${minimo} y ${maximo}`,
      );
    } else {
      opcionales[clave] = numero;
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

  const rechazarEjemploInvalid =
    leerTexto(crudas['CORREO_RECHAZAR_EJEMPLO_INVALID']) ?? 'false';
  if (rechazarEjemploInvalid !== 'true' && rechazarEjemploInvalid !== 'false') {
    errores.push('CORREO_RECHAZAR_EJEMPLO_INVALID debe ser true o false');
  }

  // Lista permitida de la demostración (F5a): una dirección exacta o un
  // prefijo local terminado en «*» con dominio fijo; nada de comodines libres.
  const destinoPermitido =
    leerTexto(crudas['CORREO_DESTINO_PERMITIDO'])?.toLowerCase() ?? null;
  if (
    destinoPermitido !== null &&
    !/^[^\s@*]+\*?@[^\s@*]+\.[^\s@*]+$/.test(destinoPermitido)
  ) {
    errores.push(
      'CORREO_DESTINO_PERMITIDO debe ser una dirección o un prefijo terminado en * con dominio fijo',
    );
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

  // B4: ambas son opcionales; vacías desactivan la tarea nocturna o la ruta
  // HTTP del disparo manual.
  const horaNocturna =
    leerTexto(crudas['SINCRONIZACION_HORA_NOCTURNA']) ?? null;
  if (horaNocturna !== null && !FORMATO_HORA.test(horaNocturna)) {
    errores.push('SINCRONIZACION_HORA_NOCTURNA debe tener el formato HH:MM');
  }
  const secretoSincronizacion =
    leerTexto(crudas['SINCRONIZACION_SECRETO']) ?? null;
  if (
    secretoSincronizacion !== null &&
    secretoSincronizacion.length < LONGITUD_MINIMA_SECRETO
  ) {
    errores.push(
      `SINCRONIZACION_SECRETO debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres`,
    );
  }

  const correo = validarCorreo(crudas, nodeEnv, errores);

  if (errores.length > 0) {
    throw new Error(
      `Variables de entorno inválidas:\n- ${errores.join('\n- ')}`,
    );
  }

  return {
    CORREO: correo as ConfiguracionCorreoEntorno,
    SINCRONIZACION_HORA_NOCTURNA: horaNocturna,
    SINCRONIZACION_SECRETO: secretoSincronizacion,
    ...(textos as Record<
      Exclude<
        ClaveTexto,
        | 'URL_FRONTEND'
        | 'SINCRONIZACION_HORA_NOCTURNA'
        | 'SINCRONIZACION_SECRETO'
      >,
      string
    >),
    ...(puertos as Record<ClavePuerto, number>),
    ...(enteros as Record<ClaveEntero, number>),
    ...(opcionales as Record<ClaveEnteroOpcional, number>),
    COOKIE_SEGURA: cookieSegura === 'true',
    CORREO_RECHAZAR_EJEMPLO_INVALID: rechazarEjemploInvalid === 'true',
    CORREO_DESTINO_PERMITIDO: destinoPermitido,
    URL_FRONTEND: origenFrontend as string,
    NODE_ENV: nodeEnv as EntornoEjecucion,
  };
}

/** Variables del correo saliente (B5). */
function validarCorreo(
  crudas: Record<string, unknown>,
  nodeEnv: string | undefined,
  errores: string[],
): ConfiguracionCorreoEntorno | null {
  const modo = leerTexto(crudas['CORREO_MODO']) ?? 'smtp';
  if (modo === 'desactivado') {
    if (nodeEnv === 'production') {
      errores.push('CORREO_MODO=desactivado no se admite en producción');
    }
    return { modo: 'desactivado' };
  }
  if (modo !== 'smtp') {
    errores.push('CORREO_MODO debe ser smtp o desactivado');
    return null;
  }
  const faltan = [
    'CORREO_SMTP_HOST',
    'CORREO_SMTP_PUERTO',
    'CORREO_SMTP_USUARIO',
    'CORREO_SMTP_CLAVE',
    'CORREO_REMITENTE',
    'CORREO_REMITENTE_NOMBRE',
  ].filter((clave) => leerTexto(crudas[clave]) === undefined);
  if (faltan.length > 0) {
    errores.push(
      `Falta la configuración SMTP (${faltan.join(', ')}); para no enviar correos declare CORREO_MODO=desactivado`,
    );
    return null;
  }
  const puerto = Number(leerTexto(crudas['CORREO_SMTP_PUERTO']));
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    errores.push('CORREO_SMTP_PUERTO debe ser un entero entre 1 y 65535');
  }
  const remitente = leerTexto(crudas['CORREO_REMITENTE']) ?? '';
  if (!FORMATO_CORREO.test(remitente)) {
    errores.push('CORREO_REMITENTE debe ser un correo válido');
  }
  const remitenteNombre = leerTexto(crudas['CORREO_REMITENTE_NOMBRE']) ?? '';
  if (/[\r\n]/.test(remitenteNombre)) {
    errores.push('CORREO_REMITENTE_NOMBRE no admite saltos de línea');
  }
  return {
    modo: 'smtp',
    host: leerTexto(crudas['CORREO_SMTP_HOST']) ?? '',
    puerto,
    usuario: leerTexto(crudas['CORREO_SMTP_USUARIO']) ?? '',
    clave: leerTexto(crudas['CORREO_SMTP_CLAVE']) ?? '',
    remitente,
    remitenteNombre,
  };
}
