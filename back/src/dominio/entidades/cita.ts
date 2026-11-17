import { randomUUID } from 'node:crypto';
import { Asesoria } from './asesoria';
import { EstadoCita } from './estado-cita';
import type { Modalidad } from './modalidad';
import type { TipoAsesoria } from './tipo-asesoria';

export interface PropiedadesCita {
  idCita: string;
  fechaHora: Date;
  modalidad: Modalidad;
  estado: EstadoCita;
  /** Asesoría generada al atender la cita (asociación "genera", 0..1). */
  asesoria: Asesoria | null;
}

/**
 * Entidad `Cita`. Estados: PROGRAMADA, REPROGRAMADA y CERRADA; pasa a
 * CERRADA al generar la asesoría, con o sin asistencia (línea base §4).
 */
export class Cita {
  readonly #idCita: string;
  #fechaHora: Date;
  readonly #modalidad: Modalidad;
  #estado: EstadoCita;
  #asesoria: Asesoria | null;

  constructor(propiedades: PropiedadesCita) {
    this.#idCita = propiedades.idCita;
    this.#fechaHora = new Date(propiedades.fechaHora);
    this.#modalidad = propiedades.modalidad;
    this.#estado = propiedades.estado;
    this.#asesoria = propiedades.asesoria;
  }

  get idCita(): string {
    return this.#idCita;
  }

  get fechaHora(): Date {
    return new Date(this.#fechaHora);
  }

  get modalidad(): Modalidad {
    return this.#modalidad;
  }

  get estado(): EstadoCita {
    return this.#estado;
  }

  get asesoria(): Asesoria | null {
    return this.#asesoria;
  }

  /**
   * Cambia la fecha de la cita (sd_CUD06, 4.a). No se limita el número de
   * reprogramaciones (D8: no implementar).
   * El cruce de horario NO se verifica aquí, porque la cita no conoce a su
   * psicólogo: es una regla del servicio de B7, que debe llamar a
   * `Psicologo.estaDisponible(fechaHora)` antes de reprogramar (ER R05).
   */
  reprogramar(fechaHora: Date): void {
    this.#exigirNoCerrada();
    this.#fechaHora = new Date(fechaHora);
    this.#estado = EstadoCita.REPROGRAMADA;
  }

  /**
   * Registra el resultado de la cita (CUD08 dentro de sd_CUD06) y la cierra.
   * El bloqueo por consentimiento del menor (R06) lo aplica el servicio en
   * B7, porque la cita no conoce su caso.
   */
  generarAsesoria(
    tipo: TipoAsesoria,
    observaciones: string,
    acuerdos: string,
    asistencia: boolean,
    requiereSeguimiento: boolean,
    presentaRiesgoCritico: boolean,
  ): Asesoria {
    this.#exigirNoCerrada();
    const asesoria = new Asesoria({
      idAsesoria: randomUUID(),
      fecha: new Date(),
      tipoAsesoria: tipo,
      observaciones,
      acuerdos,
      asistencia,
      requiereSeguimiento,
      presentaRiesgoCritico,
    });
    this.#asesoria = asesoria;
    this.#estado = EstadoCita.CERRADA;
    return asesoria;
  }

  #exigirNoCerrada(): void {
    if (this.#estado === EstadoCita.CERRADA) {
      throw new Error('La cita ya está cerrada');
    }
  }
}
