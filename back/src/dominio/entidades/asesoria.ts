import type { TipoAsesoria } from './tipo-asesoria';

export interface PropiedadesAsesoria {
  idAsesoria: string;
  fecha: Date;
  tipoAsesoria: TipoAsesoria;
  observaciones: string;
  acuerdos: string;
  asistencia: boolean;
  requiereSeguimiento: boolean;
  presentaRiesgoCritico: boolean;
}

/**
 * Entidad `Asesoria`: resultado de una cita (R06, CUD08 dentro de sd_CUD06).
 * La asistencia vive aquí (línea base §4).
 */
export class Asesoria {
  readonly #idAsesoria: string;
  readonly #fecha: Date;
  readonly #tipoAsesoria: TipoAsesoria;
  readonly #observaciones: string;
  readonly #acuerdos: string;
  readonly #asistencia: boolean;
  readonly #requiereSeguimiento: boolean;
  readonly #presentaRiesgoCritico: boolean;

  constructor(propiedades: PropiedadesAsesoria) {
    this.#idAsesoria = propiedades.idAsesoria;
    this.#fecha = new Date(propiedades.fecha);
    this.#tipoAsesoria = propiedades.tipoAsesoria;
    this.#observaciones = propiedades.observaciones;
    this.#acuerdos = propiedades.acuerdos;
    this.#asistencia = propiedades.asistencia;
    this.#requiereSeguimiento = propiedades.requiereSeguimiento;
    this.#presentaRiesgoCritico = propiedades.presentaRiesgoCritico;
  }

  get idAsesoria(): string {
    return this.#idAsesoria;
  }

  get fecha(): Date {
    return new Date(this.#fecha);
  }

  get tipoAsesoria(): TipoAsesoria {
    return this.#tipoAsesoria;
  }

  get observaciones(): string {
    return this.#observaciones;
  }

  get acuerdos(): string {
    return this.#acuerdos;
  }

  get asistencia(): boolean {
    return this.#asistencia;
  }

  get requiereSeguimiento(): boolean {
    return this.#requiereSeguimiento;
  }

  get presentaRiesgoCritico(): boolean {
    return this.#presentaRiesgoCritico;
  }

  /**
   * Una asesoría está completa cuando tiene observaciones (ER R06; sd_CUD06,
   * 6.b.2a: "Diligencie las observaciones de la asesoría"). Los acuerdos no
   * son obligatorios.
   */
  estaCompleta(): boolean {
    return this.#observaciones.trim() !== '';
  }
}
