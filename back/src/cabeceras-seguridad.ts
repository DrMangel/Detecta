import { COOKIE_SESION, leerCookie } from './controladores/sesion';

/*
 * Cabeceras de seguridad HTTP (fase B9, S7; respuesta 5 y ajuste E de Ivan).
 * Sin dependencias (sin helmet). La API solo devuelve JSON y el PDF del
 * informe: no sirve HTML, así que la política de contenido lo prohíbe todo.
 */

/** Cabeceras de todas las respuestas. */
export const CABECERAS_SEGURIDAD: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

/** HSTS: solo con COOKIE_SEGURA=true, es decir, detrás de HTTPS. */
export const CABECERA_HSTS = 'max-age=31536000; includeSubDomains';

/**
 * Las respuestas autenticadas (con la cookie de sesión), las de /acceso/* y
 * el PDF no se guardan en caché: equipos compartidos de los laboratorios
 * (ajuste E; ajuste 5 del informe parcial 1: también el inicio de sesión).
 */
export const SIN_CACHE = 'no-store';

/** Prefijo de las rutas de acceso (ControladorAcceso, B3). */
const PREFIJO_ACCESO = '/acceso';

interface PeticionMinima {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * true si la petición va a /acceso o /acceso/*. Express enruta sin
 * distinguir mayúsculas, así que la comparación tampoco las distingue.
 */
function esRutaAcceso(url: string | undefined): boolean {
  const ruta = (url ?? '').split('?')[0]!.toLowerCase();
  return ruta === PREFIJO_ACCESO || ruta.startsWith(`${PREFIJO_ACCESO}/`);
}
interface RespuestaMinima {
  setHeader(nombre: string, valor: string): void;
}

/** Middleware de Express que aplica las cabeceras anteriores. */
export function middlewareCabeceras(hsts: boolean) {
  return (
    peticion: PeticionMinima,
    respuesta: RespuestaMinima,
    siguiente: () => void,
  ): void => {
    for (const [nombre, valor] of Object.entries(CABECERAS_SEGURIDAD)) {
      respuesta.setHeader(nombre, valor);
    }
    if (hsts) {
      respuesta.setHeader('Strict-Transport-Security', CABECERA_HSTS);
    }
    if (
      esRutaAcceso(peticion.url) ||
      leerCookie(peticion.headers['cookie'], COOKIE_SESION) !== undefined
    ) {
      respuesta.setHeader('Cache-Control', SIN_CACHE);
    }
    siguiente();
  };
}
