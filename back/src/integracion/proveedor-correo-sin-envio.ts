import { Logger } from '@nestjs/common';
import type { ProveedorCorreo } from '../aplicacion/contratos/proveedor-correo';

/**
 * Adaptador provisional de `ProveedorCorreo` hasta B5 (respuesta 7a de Ivan
 * en el plan de B3; NO está en el diagrama: se reporta como diferencia).
 *
 * No envía nada: devuelve false y registra una advertencia SIN destinatario,
 * token ni enlace (Ley 1581: el correo es dato personal; el enlace es una
 * credencial). Mientras tanto, las cuentas se activan con el enlace que
 * imprime `npm run datos:iniciales`. En B5 lo reemplaza
 * `ProveedorCorreoExterno` (SMTP/TLS con Brevo).
 */
export class ProveedorCorreoSinEnvio implements ProveedorCorreo {
  readonly #registro = new Logger('ProveedorCorreo');

  enviar(
    _destino: string,
    asunto: string,
    _cuerpoHtml: string,
  ): Promise<boolean> {
    this.#registro.warn(
      `Correo no enviado ("${asunto}"): el proveedor real de correo llega en B5`,
    );
    return Promise.resolve(false);
  }
}
