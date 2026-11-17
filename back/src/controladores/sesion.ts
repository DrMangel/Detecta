import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Persona } from '../dominio/entidades/persona';

/*
 * Piezas de la sesión para los controladores (B3). No están en el diagrama
 * de clases: son mecanismos de NestJS que acompañan al guard (Manual
 * 4.1.1.5). Se reportan como diferencias en el informe de cierre.
 */

/** Nombre de la cookie de sesión (JWT, HttpOnly, Secure, SameSite=Strict). */
export const COOKIE_SESION = 'detecta_sesion';

/** Petición HTTP con el usuario de la sesión ya cargado de la BD. */
export interface PeticionConSesion {
  headers: Record<string, string | string[] | undefined>;
  usuario?: Persona;
}

export const CLAVE_RUTA_PUBLICA = 'detecta:rutaPublica';

/** Marca una ruta que no exige sesión (iniciar sesión, activación...). */
export const Publico = (): MethodDecorator & ClassDecorator =>
  SetMetadata(CLAVE_RUTA_PUBLICA, true);

/** Inyecta en el método del controlador la Persona de la sesión. */
export const UsuarioSesion = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): Persona => {
    const peticion = contexto.switchToHttp().getRequest<PeticionConSesion>();
    if (!peticion.usuario) {
      throw new Error('UsuarioSesion se usó en una ruta sin GuardSesion');
    }
    return peticion.usuario;
  },
);

/**
 * Lee una cookie de la cabecera `Cookie` sin dependencias externas.
 * Devuelve undefined si falta o está mal formada.
 */
export function leerCookie(
  cabecera: string | string[] | undefined,
  nombre: string,
): string | undefined {
  const texto = Array.isArray(cabecera) ? cabecera.join('; ') : cabecera;
  if (!texto) {
    return undefined;
  }
  for (const parte of texto.split(';')) {
    const separador = parte.indexOf('=');
    if (separador === -1) {
      continue;
    }
    if (parte.slice(0, separador).trim() === nombre) {
      const valor = parte.slice(separador + 1).trim();
      try {
        return decodeURIComponent(valor);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
