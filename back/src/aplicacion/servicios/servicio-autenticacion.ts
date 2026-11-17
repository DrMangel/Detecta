import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  leerContrasenaHash,
  type Persona,
} from '../../dominio/entidades/persona';
import type { RepositorioCredenciales } from '../../dominio/repositorios/repositorio-credenciales';
import type { RepositorioPersona } from '../../dominio/repositorios/repositorio-persona';
import {
  REPOSITORIO_CREDENCIALES,
  REPOSITORIO_PERSONA,
} from '../../dominio/repositorios/tokens';
import {
  PROVEEDOR_CORREO,
  type ProveedorCorreo,
} from '../contratos/proveedor-correo';
import { esHashBcrypt, hashContrasenas } from './hash-contrasenas';

/** Configuración de la autenticación (variables de entorno validadas). */
export interface ConfiguracionAutenticacion {
  bcryptCosto: number;
  activacionDuracionMin: number;
  /** Origen del frontend, sin barra final. */
  urlFrontend: string;
}

export const CONFIGURACION_AUTENTICACION = Symbol('ConfiguracionAutenticacion');
/** Reloj inyectable para probar caducidades. */
export const RELOJ = Symbol('Reloj');
export type Reloj = () => Date;

/** Mismo mensaje para correo inexistente, cuenta sin activar y contraseña errónea. */
export const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos';
export const MENSAJE_ENLACE_INVALIDO = 'El enlace no es válido o ya caducó';

const LONGITUD_MINIMA_CONTRASENA = 12;
/** Límite de bcrypt: solo usa los primeros 72 bytes. */
const BYTES_MAXIMOS_CONTRASENA = 72;
/** D16: como máximo 3 solicitudes de enlace por cuenta y por hora. */
const SOLICITUDES_MAXIMAS_POR_HORA = 3;
const UNA_HORA_MS = 60 * 60 * 1000;
/** Token de 32 bytes aleatorios en base64url: 43 caracteres. */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function hashDeToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Servicio `ServicioAutenticacion` (diagrama de clases v3:
 * `autenticar(correo, contrasena): Persona`).
 *
 * Fuera del diagrama, por D6 (aprobado por Ivan): `solicitarActivacion`,
 * `activarCuenta` y `emitirEnlaceActivacion`, y la dependencia hacia
 * `ProveedorCorreo`.
 *
 * Nunca registra ni devuelve contraseñas, hashes ni tokens.
 */
@Injectable()
export class ServicioAutenticacion
  implements OnModuleInit, OnApplicationShutdown
{
  readonly #registro = new Logger('ServicioAutenticacion');
  readonly #tareasEnCurso = new Set<Promise<void>>();
  #hashFicticio: Promise<string> | undefined;

  constructor(
    @Inject(REPOSITORIO_PERSONA)
    private readonly personas: RepositorioPersona,
    @Inject(REPOSITORIO_CREDENCIALES)
    private readonly credenciales: RepositorioCredenciales,
    @Inject(PROVEEDOR_CORREO)
    private readonly correo: ProveedorCorreo,
    @Inject(CONFIGURACION_AUTENTICACION)
    private readonly configuracion: ConfiguracionAutenticacion,
    @Inject(RELOJ)
    private readonly reloj: Reloj,
  ) {}

  /**
   * Verifica correo y contraseña (ER 1.3.1). Para que el tiempo de respuesta
   * no revele si el correo existe o si la cuenta está activada, se hace
   * exactamente UNA comparación bcrypt en todas las ramas: contra el hash real
   * si existe y es válido, o contra un hash ficticio del mismo costo
   * (ajuste A de Ivan).
   */
  async autenticar(correo: string, contrasena: string): Promise<Persona> {
    const persona = await this.personas.buscarPorCorreo(correo.trim());
    const hashGuardado = persona ? leerContrasenaHash(persona) : null;
    const hashUtilizable = hashGuardado !== null && esHashBcrypt(hashGuardado);
    const coincide = await hashContrasenas.comparar(
      contrasena,
      hashUtilizable ? hashGuardado : await this.#obtenerHashFicticio(),
    );
    if (persona === null || !hashUtilizable || !coincide) {
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }
    return persona;
  }

  /**
   * D6: pide un enlace de activación o recuperación. Responde de inmediato,
   * sin esperar la búsqueda ni el envío (ajuste B de Ivan): el tiempo y la
   * respuesta son iguales exista o no el correo. El trabajo sigue en segundo
   * plano y sus errores se registran sin datos personales.
   */
  solicitarActivacion(correo: string): void {
    const tarea = this.#procesarSolicitud(correo.trim())
      .catch((error: unknown) => {
        this.#registro.error(
          `Falló una solicitud de activación: ${error instanceof Error ? error.name : 'error'}`,
        );
      })
      .finally(() => this.#tareasEnCurso.delete(tarea));
    this.#tareasEnCurso.add(tarea);
  }

  /**
   * D6: canjea el token y fija la contraseña. El token llega en el cuerpo del
   * POST, nunca en la URL (ajuste E). Cualquier token no canjeable responde
   * con el mismo mensaje genérico.
   */
  async activarCuenta(token: string, contrasena: string): Promise<void> {
    this.#validarPoliticaContrasena(contrasena);
    if (!FORMATO_TOKEN.test(token)) {
      throw new BadRequestException(MENSAJE_ENLACE_INVALIDO);
    }
    const nuevoHash = await hashContrasenas.generar(
      contrasena,
      this.configuracion.bcryptCosto,
    );
    const canjeado = await this.credenciales.canjearToken(
      hashDeToken(token),
      nuevoHash,
      this.reloj(),
    );
    if (!canjeado) {
      throw new BadRequestException(MENSAJE_ENLACE_INVALIDO);
    }
  }

  /**
   * Genera y registra un token (solo su hash) y devuelve el enlace con el
   * token en claro. Lo usan el envío por correo y el script de datos
   * iniciales, que lo imprime al operador (respuesta 8d de Ivan).
   *
   * El token va en el fragmento (#) de la URL del frontend: los navegadores
   * no envían el fragmento al servidor ni en la cabecera Referer.
   */
  async emitirEnlaceActivacion(persona: Persona): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const creadoEn = this.reloj();
    await this.credenciales.registrarToken({
      idToken: randomUUID(),
      idPersona: persona.id,
      hashToken: hashDeToken(token),
      creadoEn,
      expiraEn: new Date(
        creadoEn.getTime() + this.configuracion.activacionDuracionMin * 60_000,
      ),
    });
    return `${this.configuracion.urlFrontend}/activar#token=${token}`;
  }

  /**
   * Precalcula el hash ficticio al iniciar: si se calculara en el primer
   * inicio de sesión fallido, ese primer intento tardaría más y delataría
   * un correo inexistente.
   */
  async onModuleInit(): Promise<void> {
    await this.#obtenerHashFicticio();
  }

  /** Espera las solicitudes en segundo plano al cerrar la aplicación. */
  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.#tareasEnCurso);
  }

  async #procesarSolicitud(correo: string): Promise<void> {
    const persona = await this.personas.buscarPorCorreo(correo);
    if (persona === null) {
      return;
    }
    const haceUnaHora = new Date(this.reloj().getTime() - UNA_HORA_MS);
    const recientes = await this.credenciales.contarTokensDesde(
      persona.id,
      haceUnaHora,
    );
    if (recientes >= SOLICITUDES_MAXIMAS_POR_HORA) {
      // D16: se omite sin avisar, para no revelar el límite ni la cuenta.
      return;
    }
    const enlace = await this.emitirEnlaceActivacion(persona);
    // El correo no incluye datos sensibles (Manual 4.1.1.6), solo el enlace.
    await this.correo.enviar(
      persona.correo,
      'DETECTA: activa tu cuenta o restablece tu contraseña',
      `<p>Hola, ${escaparHtml(persona.nombre)}.</p>` +
        `<p>Para fijar tu contraseña en DETECTA abre este enlace. ` +
        `Vence en ${this.configuracion.activacionDuracionMin} minutos y solo sirve una vez:</p>` +
        `<p><a href="${enlace}">${enlace}</a></p>` +
        `<p>Si no lo solicitaste, ignora este mensaje.</p>`,
    );
  }

  /** Política aprobada: mínimo 12 caracteres y máximo 72 bytes UTF-8. */
  #validarPoliticaContrasena(contrasena: string): void {
    if (contarCaracteres(contrasena) < LONGITUD_MINIMA_CONTRASENA) {
      throw new BadRequestException(
        `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`,
      );
    }
    if (Buffer.byteLength(contrasena, 'utf8') > BYTES_MAXIMOS_CONTRASENA) {
      throw new BadRequestException(
        `La contraseña no puede superar ${BYTES_MAXIMOS_CONTRASENA} bytes`,
      );
    }
  }

  #obtenerHashFicticio(): Promise<string> {
    this.#hashFicticio ??= hashContrasenas.generar(
      randomBytes(16).toString('hex'),
      this.configuracion.bcryptCosto,
    );
    return this.#hashFicticio;
  }
}

/** Caracteres visibles (grafemas): un emoji o una letra con tilde cuentan 1. */
function contarCaracteres(texto: string): number {
  let total = 0;
  for (const _ of new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(
    texto,
  )) {
    total += 1;
  }
  return total;
}

function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
