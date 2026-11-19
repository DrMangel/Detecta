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

export interface OpcionesPeticion {
  /** false en las rutas públicas y en la consulta inicial de la sesión. */
  sesionRequerida?: boolean;
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

export async function pedir<T>(
  metodo: Metodo,
  ruta: string,
  cuerpo?: unknown,
  { sesionRequerida = true }: OpcionesPeticion = {},
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers:
        cuerpo === undefined
          ? { Accept: 'application/json' }
          : {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
  } catch {
    throw errorDeRed();
  }
  const datos = await leerCuerpo(respuesta);
  if (!respuesta.ok) {
    const error = errorDeRespuesta(
      respuesta.status,
      datos,
      respuesta.headers.get('Retry-After'),
    );
    if (error.estado === 401 && sesionRequerida) {
      alSesionInvalida?.(error.message);
    }
    throw error;
  }
  return datos as T;
}
