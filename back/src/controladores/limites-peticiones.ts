/*
 * Límites del limitador de peticiones (fase B9, D15; respuesta 1 y ajuste A
 * de Ivan). Todos los límites viven en este archivo.
 *
 * Limitación aceptada: el limitador es en memoria y por instancia. Se pierde
 * al reiniciar y no se comparte entre instancias.
 */

const MINUTO_MS = 60_000;

/** iniciar-sesion: solo cuentan los FALLOS, en una ventana de 15 minutos. */
export const VENTANA_INICIO_SESION_MS = 15 * MINUTO_MS;
/** Fallos por par (IP, correo normalizado); un inicio exitoso lo reinicia. */
export const FALLOS_INICIO_POR_IP_Y_CORREO = 10;
/** Fallos por IP: alto, porque un campus comparte IP. */
export const FALLOS_INICIO_POR_IP = 100;

/**
 * solicitar-activacion: cuentan TODAS las peticiones, en una ventana de una
 * hora, ANTES de consultar si el correo existe (no filtra su existencia).
 */
export const VENTANA_ACTIVACION_MS = 60 * MINUTO_MS;
export const SOLICITUDES_ACTIVACION_POR_IP = 30;
/** Protege el cupo de 300 correos diarios de Brevo. */
export const SOLICITUDES_ACTIVACION_POR_CORREO = 3;

/** Tope de claves en memoria (memoria acotada). */
export const TOPE_CLAVES = 50_000;

/** Texto aprobado (respuesta 1). */
export const MENSAJE_DEMASIADOS_INTENTOS =
  'Demasiados intentos. Intente de nuevo más tarde.';
