import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { RepositorioPersona } from '../dominio/repositorios/repositorio-persona';
import { REPOSITORIO_PERSONA } from '../dominio/repositorios/tokens';
import {
  CLAVE_RUTA_PUBLICA,
  COOKIE_SESION,
  leerCookie,
  type PeticionConSesion,
} from './sesion';

export const MENSAJE_SIN_SESION = 'Sesión no válida o caducada';

/**
 * Guard global de sesión (Manual 4.1.1.5: "en cada solicitud, un guard de
 * NestJS valida el token e identifica al usuario").
 *
 * - Verifica el JWT de la cookie con el algoritmo fijado a HS256 (ajuste C).
 * - Carga la Persona de la BD por `sub`; el rol que se usa para autorizar es
 *   `persona.obtenerRol()`, nunca el claim del token (ajuste C).
 * - Sin cookie, token inválido o caducado, o persona inexistente: 401.
 */
@Injectable()
export class GuardSesion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(REPOSITORIO_PERSONA)
    private readonly personas: RepositorioPersona,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(
      CLAVE_RUTA_PUBLICA,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (esPublica) {
      return true;
    }
    const peticion = contexto.switchToHttp().getRequest<PeticionConSesion>();
    const token = leerCookie(peticion.headers['cookie'], COOKIE_SESION);
    if (!token) {
      throw new UnauthorizedException(MENSAJE_SIN_SESION);
    }
    let idPersona: unknown;
    try {
      const contenido = await this.jwt.verifyAsync<{ sub?: unknown }>(token, {
        algorithms: ['HS256'],
      });
      idPersona = contenido.sub;
    } catch {
      throw new UnauthorizedException(MENSAJE_SIN_SESION);
    }
    if (typeof idPersona !== 'string' || idPersona === '') {
      throw new UnauthorizedException(MENSAJE_SIN_SESION);
    }
    const persona = await this.personas.buscarPorId(idPersona);
    if (persona === null) {
      throw new UnauthorizedException(MENSAJE_SIN_SESION);
    }
    peticion.usuario = persona;
    return true;
  }
}
