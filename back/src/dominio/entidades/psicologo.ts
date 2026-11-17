import type { Cita } from './cita';
import { EstadoCita } from './estado-cita';
import { Persona, type PropiedadesPersona } from './persona';
import { Rol } from './rol';

export interface PropiedadesPsicologo extends PropiedadesPersona {
  /** Citas de su agenda (asociación "agenda"). */
  citas: readonly Cita[];
}

/** Entidad `Psicologo` (subclase de `Persona`). */
export class Psicologo extends Persona {
  readonly #citas: Cita[];

  constructor(propiedades: PropiedadesPsicologo) {
    super(propiedades);
    this.#citas = [...propiedades.citas];
  }

  get citas(): readonly Cita[] {
    return [...this.#citas];
  }

  obtenerRol(): Rol {
    return Rol.PSICOLOGO;
  }

  /**
   * Verifica el cruce de horario al programar una cita (sd_CUD06, 4.a de
   * CUD07). Hay cruce solo si ya existe una cita PROGRAMADA o REPROGRAMADA
   * exactamente en esa fecha y hora: la duración de las citas no está
   * definida (decisión abierta D9).
   */
  estaDisponible(fechaHora: Date): boolean {
    return !this.#citas.some(
      (cita) =>
        (cita.estado === EstadoCita.PROGRAMADA ||
          cita.estado === EstadoCita.REPROGRAMADA) &&
        cita.fechaHora.getTime() === fechaHora.getTime(),
    );
  }

  /**
   * Auxiliar fuera del diagrama (pedido en la auditoría de B1): registra una
   * cita en la agenda (asociación "agenda"). Lo invoca
   * `CasoRiesgo.programarCita` después de verificar `estaDisponible`.
   */
  agendar(cita: Cita): void {
    this.#citas.push(cita);
  }
}
