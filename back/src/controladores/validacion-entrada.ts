import { BadRequestException } from '@nestjs/common';

/*
 * Validación de las entradas HTTP de B6 (ajuste C de Ivan):
 * - el cuerpo es un objeto JSON, sin campos desconocidos;
 * - cada campo de texto es una cadena (se rechazan objetos y arreglos);
 * - longitudes máximas técnicas, coherentes con las columnas del esquema
 *   (`text` en origen_riesgo; `varchar(20)` en curso.periodo; `varchar(36)`
 *   en los identificadores), para que nunca haya un 500 por truncado;
 * - solo son obligatorios los campos que exige la secuencia.
 */

/** Texto nuevo (no viene del ER): aprobado por Ivan en el plan de B6. */
export const MENSAJE_LONGITUD_EXCEDIDA =
  'El texto excede la longitud permitida.';
/** Texto nuevo: cuerpo que no es un objeto, campo desconocido o tipo inválido. */
export const MENSAJE_SOLICITUD_NO_VALIDA = 'La solicitud no es válida.';
/** Texto nuevo: falta el parámetro obligatorio `periodo` (ajuste D). */
export const MENSAJE_PERIODO_OBLIGATORIO = 'Indique el periodo académico.';

/** Límites técnicos aprobados (respuesta 11) y tamaños de columna. */
export const LONGITUD_MAXIMA = {
  descripcion: 2000,
  motivo: 2000,
  disponibilidad: 500,
  /** curso.periodo varchar(20) */
  periodo: 20,
  /** Identificadores varchar(36) */
  identificador: 36,
} as const;

/** Devuelve el cuerpo como registro si es un objeto con solo campos permitidos. */
export function leerCuerpo(
  cuerpo: unknown,
  permitidos: readonly string[],
): Record<string, unknown> {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
  }
  const campos = cuerpo as Record<string, unknown>;
  if (Object.keys(campos).some((campo) => !permitidos.includes(campo))) {
    throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
  }
  return campos;
}

/**
 * Lee un campo de texto. Ausente, nulo o solo espacios cuenta como vacío y
 * devuelve ''. Cualquier otro tipo (número, objeto, arreglo) es 400.
 */
export function leerTexto(
  campos: Record<string, unknown>,
  campo: string,
  maximo: number,
): string {
  const valor = campos[campo];
  if (valor === undefined || valor === null) {
    return '';
  }
  if (typeof valor !== 'string') {
    throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
  }
  if (valor.length > maximo) {
    throw new BadRequestException(MENSAJE_LONGITUD_EXCEDIDA);
  }
  return valor.trim() === '' ? '' : valor;
}

/** Valor de un enumerado, o null si falta; otro valor es 400. */
export function leerEnumerado<E extends string>(
  campos: Record<string, unknown>,
  campo: string,
  valores: readonly E[],
): E | null {
  const valor = campos[campo];
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  if (
    typeof valor !== 'string' ||
    !(valores as readonly string[]).includes(valor)
  ) {
    throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
  }
  return valor as E;
}

/** Parámetro de consulta `periodo`: obligatorio, texto libre (ajuste D, D12). */
export function leerPeriodo(valor: unknown): string {
  if (valor === undefined || valor === '') {
    throw new BadRequestException(MENSAJE_PERIODO_OBLIGATORIO);
  }
  // Un parámetro repetido llega como arreglo; un objeto, como ?periodo[a]=.
  if (typeof valor !== 'string') {
    throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
  }
  if (valor.trim() === '') {
    throw new BadRequestException(MENSAJE_PERIODO_OBLIGATORIO);
  }
  if (valor.length > LONGITUD_MAXIMA.periodo) {
    throw new BadRequestException(MENSAJE_LONGITUD_EXCEDIDA);
  }
  return valor;
}
