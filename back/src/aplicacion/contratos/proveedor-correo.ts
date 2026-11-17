/**
 * Contrato `ProveedorCorreo` (diagrama de clases v3 y de paquetes:
 * `aplicacion/contratos`). Firma del diagrama:
 * `enviar(destino, asunto, cuerpoHtml): Boolean` (asíncrono aquí).
 *
 * B3 lo usa para el correo de activación (D6, dependencia
 * ServicioAutenticacion → ProveedorCorreo aprobada por Ivan); B5 agrega
 * `ServicioNotificacion` y el adaptador real `ProveedorCorreoExterno`
 * (SMTP/TLS con Brevo).
 *
 * Devuelve true si el servicio externo aceptó el mensaje. Ante cualquier
 * fallo lanza `ErrorEnvioCorreo` (fuera del diagrama, aprobado en B5).
 * Los mensajes nunca incluyen contenido confidencial (Manual 4.1.1.6).
 */
export interface ProveedorCorreo {
  enviar(destino: string, asunto: string, cuerpoHtml: string): Promise<boolean>;
}

export const PROVEEDOR_CORREO = Symbol('ProveedorCorreo');

/**
 * Error propio de envío (B5). Solo lleva un código técnico (por ejemplo
 * EAUTH, ECONNECTION, PLAZO_AGOTADO) y el código SMTP de respuesta; nunca el
 * mensaje ni la respuesta del servidor, que podrían repetir el contenido del
 * correo (por ejemplo, el token de activación).
 */
export class ErrorEnvioCorreo extends Error {
  constructor(
    readonly codigo: string,
    readonly codigoRespuesta?: number,
  ) {
    super(
      `Error de envío (${codigo}${codigoRespuesta === undefined ? '' : ` ${codigoRespuesta}`})`,
    );
    this.name = 'ErrorEnvioCorreo';
  }
}
