/*
 * Conciliación del doble envío tras un error de red (F1, F2; plan de F1b).
 * El backend no tiene clave de idempotencia: se compara la lista de antes del
 * envío con la de después. Un elemento cuya clave no estaba antes y que
 * coincide con lo enviado es el que se registró.
 */

export interface CriterioNueva<T> {
  clave: (elemento: T) => string;
  coincide: (elemento: T) => boolean;
}

export function buscarNueva<T>(
  previas: ReadonlySet<string>,
  lista: readonly T[],
  criterio: CriterioNueva<T>,
): T | null {
  const nueva = lista.find(
    (elemento) =>
      !previas.has(criterio.clave(elemento)) && criterio.coincide(elemento),
  );
  return nueva ?? null;
}
