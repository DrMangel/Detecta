import { pedir } from './cliente';
import { ErrorApi } from './errores';
import type { DatosSesion } from './tipos';

/*
 * Rutas de /acceso (ControladorAcceso, B3; línea base §5 y §7 B3). Todas son
 * públicas salvo GET /acceso/sesion, cuyo 401 en la consulta inicial no es un
 * error: significa que no hay sesión.
 */

const PUBLICA = { sesionRequerida: false } as const;

/** POST /acceso/iniciar-sesion → 200 con los datos de la sesión. */
export function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<DatosSesion> {
  return pedir<DatosSesion>(
    'POST',
    '/acceso/iniciar-sesion',
    { correo, contrasena },
    PUBLICA,
  );
}

/** POST /acceso/cerrar-sesion → 204: expira la cookie. */
export async function cerrarSesion(): Promise<void> {
  await pedir<null>('POST', '/acceso/cerrar-sesion', undefined, PUBLICA);
}

/**
 * POST /acceso/solicitar-activacion → 202 con el mismo mensaje exista o no
 * el correo (D6). Sirve para activar la cuenta y para recuperar la
 * contraseña (D6; plan del front, F0).
 */
export function solicitarActivacion(
  correo: string,
): Promise<{ mensaje: string }> {
  return pedir<{ mensaje: string }>(
    'POST',
    '/acceso/solicitar-activacion',
    { correo },
    PUBLICA,
  );
}

/** POST /acceso/activar → 204; el token va en el cuerpo, nunca en la URL. */
export async function activarCuenta(
  token: string,
  contrasena: string,
): Promise<void> {
  await pedir<null>('POST', '/acceso/activar', { token, contrasena }, PUBLICA);
}

/**
 * GET /acceso/sesion: sesión vigente, o null si no la hay (401). Es la
 * consulta inicial: no muestra mensaje ni redirige (ajuste A).
 */
export async function consultarSesion(): Promise<DatosSesion | null> {
  try {
    return await pedir<DatosSesion>('GET', '/acceso/sesion', undefined, {
      sesionRequerida: false,
    });
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 401) {
      return null;
    }
    throw error;
  }
}
