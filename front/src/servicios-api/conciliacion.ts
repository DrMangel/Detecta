import { ErrorApi } from './errores';

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

/**
 * Resultado de un envío con conciliación (ajuste A de F1b). La pantalla
 * pone el texto: el del comprobante o el del resultado incierto.
 */
export type ResultadoEnvio<T> =
  { tipo: 'registrado'; valor: T } | { tipo: 'incierto' };

export interface PasosEnvio<T> {
  /** Claves ya registradas antes del envío. */
  consultarPrevias: () => Promise<ReadonlySet<string>>;
  enviar: () => Promise<T>;
  /** Busca lo enviado entre lo registrado después del envío. */
  buscar: (previas: ReadonlySet<string>) => Promise<T | null>;
}

function esErrorDeRed(fallo: unknown): boolean {
  return fallo instanceof ErrorApi && fallo.estado === null;
}

function esSesionVencida(fallo: unknown): boolean {
  return fallo instanceof ErrorApi && fallo.estado === 401;
}

/** Si la consulta previa falla no se bloquea el envío; un 401 sí corta. */
async function previasSiSePuede(
  consultar: () => Promise<ReadonlySet<string>>,
): Promise<ReadonlySet<string> | null> {
  try {
    return await consultar();
  } catch (fallo) {
    if (esSesionVencida(fallo)) {
      throw fallo;
    }
    return null;
  }
}

/** Tras un error de red: ¿quedó registrado lo enviado? */
async function conciliar<T>(
  previas: ReadonlySet<string> | null,
  buscar: (previas: ReadonlySet<string>) => Promise<T | null>,
  errorDeRed: unknown,
): Promise<ResultadoEnvio<T>> {
  if (previas === null) {
    return { tipo: 'incierto' };
  }
  let encontrado: T | null;
  try {
    encontrado = await buscar(previas);
  } catch (fallo) {
    if (esSesionVencida(fallo)) {
      throw fallo;
    }
    return { tipo: 'incierto' };
  }
  if (encontrado === null) {
    throw errorDeRed;
  }
  return { tipo: 'registrado', valor: encontrado };
}

/**
 * Envía y, si la respuesta no llega por un error de red, concilia en vez de
 * reenviar. Devuelve «registrado» o «incierto»; cualquier otro fallo (el
 * error de red cuando no quedó registrado, 4xx, 503, 401) se propaga.
 */
export async function enviarConConciliacion<T>(
  pasos: PasosEnvio<T>,
): Promise<ResultadoEnvio<T>> {
  const previas = await previasSiSePuede(pasos.consultarPrevias);
  try {
    return { tipo: 'registrado', valor: await pasos.enviar() };
  } catch (fallo) {
    if (!esErrorDeRed(fallo)) {
      throw fallo;
    }
    return conciliar(previas, pasos.buscar, fallo);
  }
}
