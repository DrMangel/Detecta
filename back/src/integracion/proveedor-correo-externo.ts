import { createTransport, type Transporter } from 'nodemailer';
import {
  ErrorEnvioCorreo,
  type ProveedorCorreo,
} from '../aplicacion/contratos/proveedor-correo';

/** ER Tabla 1: procesamiento y envío al servicio externo en menos de 5 s. */
export const PLAZO_ENVIO_MS = 5000;

export interface OpcionesProveedorCorreoExterno {
  host: string;
  puerto: number;
  usuario: string;
  /** Clave SMTP de Brevo: secreto, nunca se registra. */
  clave: string;
  remitente: string;
  remitenteNombre: string;
  /** Plazo global por envío; 5 s por defecto (ER Tabla 1). */
  plazoMs?: number;
  /**
   * CA adicional en la que confiar. SOLO la usan las pruebas, para el
   * servidor SMTP local con certificado autofirmado; la aplicación nunca la
   * configura. La verificación del certificado siempre está activa.
   */
  ca?: string;
}

const CODIGO_SEGURO = /^[A-Z][A-Z_]{1,29}$/;

/**
 * Adaptador «Adaptador» `ProveedorCorreoExterno` (diagrama de clases v3 y de
 * paquetes: `integracion`). Envía por SMTP sobre TLS a Brevo (línea base
 * §5; Manual 4.1.1.6): STARTTLS obligatorio en el puerto 587 o TLS directo
 * en el 465, TLS 1.2 como mínimo y verificación del certificado siempre.
 *
 * Seguridad (plan de B5):
 * - El logger y el debug de nodemailer están desactivados: la transcripción
 *   SMTP incluye el cuerpo (p. ej. el token de activación).
 * - Ningún error del transporte se propaga tal cual: se sustituye por
 *   `ErrorEnvioCorreo` con un código técnico, sin mensaje ni respuesta del
 *   servidor.
 * - Plazo GLOBAL de 5 s por envío (ajuste B), no la suma de los tiempos de
 *   conexión, saludo y socket.
 */
export class ProveedorCorreoExterno implements ProveedorCorreo {
  readonly #transporte: Transporter;
  readonly #remitente: { name: string; address: string };
  readonly #plazoMs: number;

  constructor(
    opciones: OpcionesProveedorCorreoExterno,
    transporte?: Transporter,
  ) {
    this.#plazoMs = opciones.plazoMs ?? PLAZO_ENVIO_MS;
    this.#remitente = {
      name: opciones.remitenteNombre,
      address: opciones.remitente,
    };
    this.#transporte =
      transporte ??
      createTransport({
        host: opciones.host,
        port: opciones.puerto,
        secure: opciones.puerto === 465,
        requireTLS: opciones.puerto !== 465,
        auth: { user: opciones.usuario, pass: opciones.clave },
        tls: {
          minVersion: 'TLSv1.2',
          ...(opciones.ca === undefined ? {} : { ca: opciones.ca }),
        },
        pool: true,
        maxConnections: 2,
        connectionTimeout: this.#plazoMs,
        greetingTimeout: this.#plazoMs,
        socketTimeout: this.#plazoMs,
        logger: false,
        debug: false,
      });
  }

  async enviar(
    destino: string,
    asunto: string,
    cuerpoHtml: string,
  ): Promise<boolean> {
    // Un salto de línea en el asunto permitiría inyectar cabeceras (ajuste C).
    if (/[\r\n]/.test(asunto)) {
      throw new ErrorEnvioCorreo('ASUNTO_INVALIDO');
    }
    let temporizador: NodeJS.Timeout | undefined;
    const plazo = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(
        () => rechazar(new ErrorEnvioCorreo('PLAZO_AGOTADO')),
        this.#plazoMs,
      );
    });
    try {
      await Promise.race([
        this.#transporte.sendMail({
          from: this.#remitente,
          to: destino,
          subject: asunto,
          html: cuerpoHtml,
        }),
        plazo,
      ]);
      return true;
    } catch (error) {
      throw sanear(error);
    } finally {
      clearTimeout(temporizador);
    }
  }

  /** Cierra las conexiones del pool al detener la aplicación (NestJS). */
  onModuleDestroy(): void {
    this.#transporte.close();
  }
}

/** Sustituye cualquier error por uno que solo lleva códigos técnicos. */
export function sanear(error: unknown): ErrorEnvioCorreo {
  if (error instanceof ErrorEnvioCorreo) {
    return error;
  }
  const detalle = (error ?? {}) as { code?: unknown; responseCode?: unknown };
  const codigo =
    typeof detalle.code === 'string' && CODIGO_SEGURO.test(detalle.code)
      ? detalle.code
      : 'DESCONOCIDO';
  const respuesta =
    typeof detalle.responseCode === 'number' &&
    Number.isInteger(detalle.responseCode)
      ? detalle.responseCode
      : undefined;
  return new ErrorEnvioCorreo(codigo, respuesta);
}
