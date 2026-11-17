import type { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import type { Persona } from '../dominio/entidades/persona';

/**
 * Controlador abstracto `ControladorBase` (diagrama de clases v3): los
 * controladores de negocio heredan `verificarPermiso`, que consulta a
 * `ControlAcceso` (Manual 4.1.1.5). ControladorAcceso y
 * ControladorSincronizacion no heredan de él (línea base §4).
 *
 * Firma del diagrama: `#verificarPermiso(usuario, accion): Boolean`. Cada
 * controlador decide qué responder cuando es falso (403 en B6 a B8).
 */
export abstract class ControladorBase {
  protected constructor(protected readonly controlAcceso: ControlAcceso) {}

  protected verificarPermiso(usuario: Persona, accion: string): boolean {
    return this.controlAcceso.puedeEjecutar(usuario, accion);
  }
}
