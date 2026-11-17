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
}

type ClaveTexto = {
  [K in keyof VariablesEntorno]: VariablesEntorno[K] extends string ? K : never;
}[keyof VariablesEntorno];

type ClavePuerto = 'PUERTO' | 'BD_DETECTA_PUERTO' | 'BD_INSTITUCIONAL_PUERTO';

const CLAVES_TEXTO: readonly Exclude<ClaveTexto, 'NODE_ENV'>[] = [
  'BD_DETECTA_HOST',
  'BD_DETECTA_NOMBRE',
  'BD_DETECTA_USUARIO',
  'BD_DETECTA_CONTRASENA',
  'BD_INSTITUCIONAL_HOST',
  'BD_INSTITUCIONAL_NOMBRE',
  'BD_INSTITUCIONAL_USUARIO',
  'BD_INSTITUCIONAL_CONTRASENA',
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

  if (errores.length > 0) {
    throw new Error(
      `Variables de entorno inválidas:\n- ${errores.join('\n- ')}`,
    );
  }

  return {
    ...(textos as Record<ClaveTexto, string>),
    ...(puertos as Record<ClavePuerto, number>),
    NODE_ENV: nodeEnv as EntornoEjecucion,
  };
}
