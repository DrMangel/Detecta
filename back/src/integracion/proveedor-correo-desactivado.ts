import { Logger } from '@nestjs/common';
import type { ProveedorCorreo } from '../aplicacion/contratos/proveedor-correo';

export const AVISO_CORREO_DESACTIVADO =
  'CORREO_MODO=desactivado: la aplicación no envía correos.';

/**
 * `ProveedorCorreo` para `CORREO_MODO=desactivado` (respuesta 4 de Ivan en el
 * plan de B5; fuera del diagrama). Solo se admite fuera de producción: avisa
 * una vez al arrancar, no envía y no registra contenido (ni destinatario,
 * ni asunto, ni cuerpo). Devuelve false.
 */
export class ProveedorCorreoDesactivado implements ProveedorCorreo {
  constructor() {
    new Logger('ProveedorCorreo').warn(AVISO_CORREO_DESACTIVADO);
  }

  enviar(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
