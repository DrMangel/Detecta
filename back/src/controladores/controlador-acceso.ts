import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Ip,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ServicioAutenticacion } from '../aplicacion/servicios/servicio-autenticacion';
import type { Persona } from '../dominio/entidades/persona';
import type { Rol } from '../dominio/entidades/rol';
import { LIMITADORES, type Limitadores } from './limitador-peticiones';
import {
  FALLOS_INICIO_POR_IP,
  FALLOS_INICIO_POR_IP_Y_CORREO,
  MENSAJE_DEMASIADOS_INTENTOS,
  SOLICITUDES_ACTIVACION_POR_CORREO,
  SOLICITUDES_ACTIVACION_POR_IP,
} from './limites-peticiones';
import { COOKIE_SESION, Publico, UsuarioSesion } from './sesion';

/** Datos públicos de la sesión: nunca el hash ni la entidad completa. */
export interface DatosSesion {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
}

/** Opciones de la cookie de sesión, desde las variables de entorno. */
export interface ConfiguracionCookie {
  segura: boolean;
  duracionMin: number;
}

export const CONFIGURACION_COOKIE = Symbol('ConfiguracionCookie');

/** Respuesta HTTP mínima que se usa (Express), sin depender de sus tipos. */
interface RespuestaCookies {
  cookie(
    nombre: string,
    valor: string,
    opciones: Record<string, unknown>,
  ): void;
  clearCookie(nombre: string, opciones: Record<string, unknown>): void;
  setHeader(nombre: string, valor: string): void;
}

const LONGITUD_MAXIMA_CORREO = 100;
const LONGITUD_MAXIMA_CONTRASENA = 1024;

function textoObligatorio(
  cuerpo: unknown,
  campo: string,
  maximo: number,
): string {
  const valor =
    typeof cuerpo === 'object' && cuerpo !== null
      ? (cuerpo as Record<string, unknown>)[campo]
      : undefined;
  if (typeof valor !== 'string' || valor === '' || valor.length > maximo) {
    throw new BadRequestException(`El campo ${campo} es obligatorio`);
  }
  return valor;
}

function datosSesion(persona: Persona): DatosSesion {
  return {
    id: persona.id,
    nombre: persona.nombre,
    correo: persona.correo,
    rol: persona.obtenerRol(),
  };
}

/**
 * Controlador `ControladorAcceso` (diagrama de clases v3). No hereda de
 * ControladorBase: al iniciar sesión aún no hay usuario sobre el cual
 * verificar permisos (Manual 4.1.1.5, línea base §4).
 *
 * Métodos del diagrama: `iniciarSesion`, `cerrarSesion`. Fuera del diagrama
 * (D6 y respuesta 12 de Ivan): `solicitarActivacion`, `activarCuenta` y
 * `consultarSesion`. Rutas aprobadas en el plan de B3.
 */
@Controller('acceso')
export class ControladorAcceso {
  constructor(
    private readonly servicio: ServicioAutenticacion,
    private readonly jwt: JwtService,
    @Inject(CONFIGURACION_COOKIE)
    private readonly cookie: ConfiguracionCookie,
    @Inject(LIMITADORES)
    private readonly limitadores: Limitadores,
  ) {}

  /**
   * POST /acceso/iniciar-sesion → 200 {id, nombre, correo, rol} + cookie; 401.
   * B9 (D15, ajuste A): solo cuentan los fallos, por (IP, correo normalizado)
   * y por IP; un inicio exitoso reinicia el contador del par; 429 con
   * Retry-After al superar el límite.
   */
  @Publico()
  @Post('iniciar-sesion')
  @HttpCode(200)
  async iniciarSesion(
    @Body() cuerpo: unknown,
    @Ip() ip: string,
    @Res({ passthrough: true }) respuesta: RespuestaCookies,
  ): Promise<DatosSesion> {
    const correo = textoObligatorio(cuerpo, 'correo', LONGITUD_MAXIMA_CORREO);
    const contrasena = textoObligatorio(
      cuerpo,
      'contrasena',
      LONGITUD_MAXIMA_CONTRASENA,
    );
    const limitador = this.limitadores.inicioSesion;
    const clavePar = `par:${ip}|${correo.trim().toLowerCase()}`;
    const claveIp = `ip:${ip}`;
    this.#exigirSinBloqueo(respuesta, [
      limitador.bloqueo(clavePar, FALLOS_INICIO_POR_IP_Y_CORREO),
      limitador.bloqueo(claveIp, FALLOS_INICIO_POR_IP),
    ]);
    let persona: Persona;
    try {
      persona = await this.servicio.autenticar(correo, contrasena);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        limitador.registrar(clavePar, FALLOS_INICIO_POR_IP_Y_CORREO);
        limitador.registrar(claveIp, FALLOS_INICIO_POR_IP);
      }
      throw error;
    }
    limitador.reiniciar(clavePar);
    // El claim `rol` es informativo: para autorizar se usa la persona de la BD.
    const token = await this.jwt.signAsync(
      { sub: persona.id, rol: persona.obtenerRol() },
      { algorithm: 'HS256', expiresIn: this.cookie.duracionMin * 60 },
    );
    respuesta.cookie(COOKIE_SESION, token, {
      ...this.#opcionesCookie(),
      maxAge: this.cookie.duracionMin * 60_000,
    });
    return datosSesion(persona);
  }

  /** POST /acceso/cerrar-sesion → 204; expira la cookie. */
  @Publico()
  @Post('cerrar-sesion')
  @HttpCode(204)
  cerrarSesion(@Res({ passthrough: true }) respuesta: RespuestaCookies): void {
    respuesta.clearCookie(COOKIE_SESION, this.#opcionesCookie());
  }

  /**
   * POST /acceso/solicitar-activacion → 202 siempre, con el mismo cuerpo (D6).
   * B9 (ajuste A): cuentan TODAS las peticiones, por IP y por correo
   * normalizado, ANTES de consultar si el correo existe, así que el 429 no
   * revela si la cuenta existe.
   */
  @Publico()
  @Post('solicitar-activacion')
  @HttpCode(202)
  solicitarActivacion(
    @Body() cuerpo: unknown,
    @Ip() ip: string,
    @Res({ passthrough: true }) respuesta: RespuestaCookies,
  ): { mensaje: string } {
    const limitador = this.limitadores.activacion;
    const claveIp = `ip:${ip}`;
    this.#exigirSinBloqueo(respuesta, [
      limitador.bloqueo(claveIp, SOLICITUDES_ACTIVACION_POR_IP),
    ]);
    limitador.registrar(claveIp, SOLICITUDES_ACTIVACION_POR_IP);
    const correo = textoObligatorio(cuerpo, 'correo', LONGITUD_MAXIMA_CORREO);
    const claveCorreo = `correo:${correo.trim().toLowerCase()}`;
    this.#exigirSinBloqueo(respuesta, [
      limitador.bloqueo(claveCorreo, SOLICITUDES_ACTIVACION_POR_CORREO),
    ]);
    limitador.registrar(claveCorreo, SOLICITUDES_ACTIVACION_POR_CORREO);
    this.servicio.solicitarActivacion(correo);
    return {
      mensaje:
        'Si el correo está registrado, recibirá un enlace para fijar su contraseña.',
    };
  }

  /** POST /acceso/activar {token, contrasena} → 204; 400 genérico (D6, ajuste E). */
  @Publico()
  @Post('activar')
  @HttpCode(204)
  async activarCuenta(@Body() cuerpo: unknown): Promise<void> {
    const token = textoObligatorio(cuerpo, 'token', 100);
    const contrasena = textoObligatorio(
      cuerpo,
      'contrasena',
      LONGITUD_MAXIMA_CONTRASENA,
    );
    await this.servicio.activarCuenta(token, contrasena);
  }

  /**
   * GET /acceso/sesion → 200 {id, nombre, correo, rol}; 401 sin sesión.
   * Fuera del diagrama (respuesta 12): el front no puede leer la cookie
   * HttpOnly y necesita saber quién está en sesión.
   */
  @Get('sesion')
  consultarSesion(@UsuarioSesion() usuario: Persona): DatosSesion {
    return datosSesion(usuario);
  }

  /** 429 con Retry-After (segundos) si alguna clave está bloqueada. */
  #exigirSinBloqueo(
    respuesta: RespuestaCookies,
    esperas: readonly (number | null)[],
  ): void {
    const segundos = esperas.filter((espera) => espera !== null);
    if (segundos.length === 0) {
      return;
    }
    respuesta.setHeader('Retry-After', String(Math.max(...segundos)));
    throw new HttpException(
      MENSAJE_DEMASIADOS_INTENTOS,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  #opcionesCookie(): Record<string, unknown> {
    return {
      httpOnly: true,
      secure: this.cookie.segura,
      sameSite: 'strict',
      path: '/',
    };
  }
}
