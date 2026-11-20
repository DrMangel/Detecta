import { errorDeRed, errorDeRespuesta } from './errores';

/*
 * Cliente HTTP de DETECTA (F0; Manual 4.1.2, paquete servicios-api).
 *
 * - La sesión viaja en la cookie HttpOnly del backend: el front nunca lee ni
 *   guarda el token. `credentials: 'same-origin'` envía la cookie porque, en
 *   desarrollo, el proxy de Vite sirve la API en el mismo sitio (/api).
 * - Un 401 en una petición que exige sesión avisa al proveedor de sesión
 *   (ajuste A), que redirige al inicio de sesión. Las rutas públicas de
 *   /acceso y la consulta inicial de la sesión no avisan.
 */

const BASE = import.meta.env.VITE_URL_API ?? '/api';

type Metodo = 'GET' | 'POST';

/** Petición a la API (F1b: un objeto en vez de cuatro argumentos). */
export interface Peticion {
  metodo: Metodo;
  ruta: string;
  cuerpo?: unknown;
  /** false en las rutas públicas y en la consulta inicial de la sesión. */
  sesionRequerida?: boolean;
  /** Textos de 403 del backend que esta ruta muestra (ver errorDeRespuesta). */
  textos403?: readonly string[];
}

type ManejadorSesionInvalida = (mensaje: string) => void;
let alSesionInvalida: ManejadorSesionInvalida | null = null;

/** Registra quién atiende un 401 en una petición protegida (uno solo). */
export function registrarSesionInvalida(
  manejador: ManejadorSesionInvalida | null,
): void {
  alSesionInvalida = manejador;
}

async function leerCuerpo(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text();
  if (texto === '') {
    return null;
  }
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

function opcionesFetch(metodo: Metodo, cuerpo: unknown): RequestInit {
  if (cuerpo === undefined) {
    return {
      method: metodo,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    };
  }
  return {
    method: metodo,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  };
}

async function enviar(peticion: Peticion): Promise<Response> {
  try {
    return await fetch(
      `${BASE}${peticion.ruta}`,
      opcionesFetch(peticion.metodo, peticion.cuerpo),
    );
  } catch {
    throw errorDeRed();
  }
}

/** Error uniforme de una respuesta no exitosa; un 401 avisa a la sesión. */
async function fallo(respuesta: Response, peticion: Peticion): Promise<never> {
  const error = errorDeRespuesta({
    estado: respuesta.status,
    cuerpo: await leerCuerpo(respuesta),
    retryAfter: respuesta.headers.get('Retry-After'),
    textos403: peticion.textos403,
  });
  if (error.estado === 401 && peticion.sesionRequerida !== false) {
    alSesionInvalida?.(error.message);
  }
  throw error;
}

export async function pedir<T>(peticion: Peticion): Promise<T> {
  const respuesta = await enviar(peticion);
  if (!respuesta.ok) {
    return fallo(respuesta, peticion);
  }
  return (await leerCuerpo(respuesta)) as T;
}

/**
 * Descarga un archivo por GET (F3, CUD10 paso 6). Devuelve solo el
 * contenido: el nombre lo pone quien llama, porque entre orígenes el CORS
 * del backend no expone Content-Disposition (ajuste C de F3).
 */
export async function descargar(ruta: string): Promise<Blob> {
  const peticion: Peticion = { metodo: 'GET', ruta };
  const respuesta = await enviar(peticion);
  if (!respuesta.ok) {
    return fallo(respuesta, peticion);
  }
  return respuesta.blob();
}
