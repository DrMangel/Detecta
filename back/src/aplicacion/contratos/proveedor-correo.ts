/**
 * Contrato `ProveedorCorreo` (diagrama de clases v3 y de paquetes:
 * `aplicacion/contratos`). Firma del diagrama:
 * `enviar(destino, asunto, cuerpoHtml): Boolean` (asíncrono aquí).
 *
 * B3 lo usa para el correo de activación (D6, dependencia
 * ServicioAutenticacion → ProveedorCorreo aprobada por Ivan). El adaptador
 * real `ProveedorCorreoExterno` (SMTP/TLS con Brevo) llega en B5.
 *
 * Los mensajes nunca incluyen contenido confidencial (Manual 4.1.1.6).
 */
export interface ProveedorCorreo {
  enviar(destino: string, asunto: string, cuerpoHtml: string): Promise<boolean>;
}

export const PROVEEDOR_CORREO = Symbol('ProveedorCorreo');
