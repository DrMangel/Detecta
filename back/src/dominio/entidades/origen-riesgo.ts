import type { CasoRiesgo } from './caso-riesgo';
import { EstadoOrigen } from './estado-origen';
import type { Estudiante } from './estudiante';

export interface PropiedadesOrigenRiesgo {
  idOrigen: string;
  fecha: Date;
  estado: EstadoOrigen;
}

/**
 * Entidad abstracta `OrigenRiesgo`. Polimorfismo (nota del diagrama): toda
 * alerta o solicitud genera un `CasoRiesgo`, y el caso depende de esta
 * abstracción, no de sus subclases.
 */
export abstract class OrigenRiesgo {
  readonly #idOrigen: string;
  readonly #fecha: Date;
  #estado: EstadoOrigen;

  protected constructor(propiedades: PropiedadesOrigenRiesgo) {
    this.#idOrigen = propiedades.idOrigen;
    this.#fecha = new Date(propiedades.fecha);
    this.#estado = propiedades.estado;
  }

  get idOrigen(): string {
    return this.#idOrigen;
  }

  get fecha(): Date {
    return new Date(this.#fecha);
  }

  get estado(): EstadoOrigen {
    return this.#estado;
  }

  abstract obtenerEstudiante(): Estudiante;

  /**
   * Genera el caso de riesgo de este origen. Cada origen genera como máximo
   * un caso (asociación "genera", 0..1): las subclases lo verifican con
   * `estaPendiente()` y llaman a `marcarAtendido()` al generarlo.
   */
  abstract generarCasoRiesgo(): CasoRiesgo;

  estaPendiente(): boolean {
    return this.#estado === EstadoOrigen.PENDIENTE;
  }

  /** Se invoca al generar el caso (aprobado por Ivan en el plan de B1). */
  protected marcarAtendido(): void {
    this.#estado = EstadoOrigen.ATENDIDO;
  }
}
