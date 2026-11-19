/*
 * Manejo uniforme de errores (F0; plan del front, «Errores uniformes»).
 *
 * - 401, 400, 409 y 429: el texto del backend (aprobado en la línea base).
 * - 403: siempre el texto aprobado en F0, nunca el «Forbidden» del backend
 *   (26 rutas responden ForbiddenException() sin texto).
 * - 503: el texto propio de la ruta (conPersistencia), o el genérico.
 * - 500 y cualquier otro código: el genérico (el 500 del backend es el
 *   «Internal server error» de NestJS, en inglés; D36).
 * - Sin respuesta (red): el texto de error de red.
 */

/** Textos nuevos de F0 (provisionales, aprobados por Ivan). */
export const TEXTO_SIN_PERMISO = 'No tiene permiso para realizar esta acción.';
export const TEXTO_ERROR_GENERICO =
  'No fue posible completar la operación. Intente de nuevo más tarde.';
export const TEXTO_ERROR_RED =
  'No fue posible conectar con el servidor. Verifique su conexión e intente de nuevo.';

/** Códigos cuyo `message` del backend se muestra tal cual. */
const CON_TEXTO_DEL_BACKEND = new Set([400, 401, 409, 429, 503]);

export class ErrorApi extends Error {
  constructor(
    /** Código HTTP, o null si no hubo respuesta (error de red). */
    readonly estado: number | null,
    mensaje: string,
    /** Solo en 429: segundos de espera según Retry-After. */
    readonly esperaSegundos: number | null = null,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

function mensajeDelCuerpo(cuerpo: unknown): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return null;
  }
  const mensaje = (cuerpo as { message?: unknown }).message;
  return typeof mensaje === 'string' && mensaje.trim() !== '' ? mensaje : null;
}

/** Segundos de Retry-After (solo el formato en segundos, el que usa la API). */
export function leerRetryAfter(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor.trim())) {
    return null;
  }
  return Number(valor.trim());
}

export interface RespuestaFallida {
  estado: number;
  cuerpo: unknown;
  retryAfter: string | null;
  textos403?: readonly string[];
}

/**
 * Traduce una respuesta no exitosa al error uniforme.
 *
 * `textos403` es la excepción aprobada en F1 (respuesta 4, ajuste E): una
 * ruta puede declarar los textos de 403 del backend que sí se muestran
 * (POST /solicitudes con D21; GET /alertas/cursos/:idCurso y POST /alertas,
 * respuesta 2 de F2). Cualquier otro 403 de esa ruta,
 * incluido el ForbiddenException() sin texto, sigue mostrando el texto de F0.
 */
export function errorDeRespuesta({
  estado,
  cuerpo,
  retryAfter,
  textos403 = [],
}: RespuestaFallida): ErrorApi {
  const delBackend = mensajeDelCuerpo(cuerpo);
  if (estado === 403) {
    return new ErrorApi(
      403,
      delBackend !== null && textos403.includes(delBackend)
        ? delBackend
        : TEXTO_SIN_PERMISO,
    );
  }
  const mensaje =
    CON_TEXTO_DEL_BACKEND.has(estado) && delBackend !== null
      ? delBackend
      : TEXTO_ERROR_GENERICO;
  return new ErrorApi(
    estado,
    mensaje,
    estado === 429 ? leerRetryAfter(retryAfter) : null,
  );
}

export function errorDeRed(): ErrorApi {
  return new ErrorApi(null, TEXTO_ERROR_RED);
}

/** Mensaje uniforme de cualquier error capturado en una pantalla. */
export function mensajeDeError(error: unknown): string {
  return error instanceof ErrorApi ? error.message : TEXTO_ERROR_GENERICO;
}
