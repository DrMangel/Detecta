import { randomUUID } from 'node:crypto';
import { EstadoOrigen } from './estado-origen';
import { Persona, type PropiedadesPersona } from './persona';
import type { Programa } from './programa';
import { Rol } from './rol';
import type { RutaAtencion } from './ruta-atencion';
import { SolicitudAcompanamiento } from './solicitud-acompanamiento';

export interface PropiedadesEstudiante extends PropiedadesPersona {
  fechaNacimiento: Date;
  /** Programa que cursa (asociación "cursa", multiplicidad 1). */
  programa: Programa;
}

/** Edad de mayoría en Colombia (Ley 27 de 1977). */
const EDAD_MAYORIA = 18;

/** Entidad `Estudiante` (subclase de `Persona`). */
export class Estudiante extends Persona {
  readonly #fechaNacimiento: Date;
  readonly #programa: Programa;

  constructor(propiedades: PropiedadesEstudiante) {
    super(propiedades);
    this.#fechaNacimiento = new Date(propiedades.fechaNacimiento);
    this.#programa = propiedades.programa;
  }

  get fechaNacimiento(): Date {
    return new Date(this.#fechaNacimiento);
  }

  obtenerRol(): Rol {
    return Rol.ESTUDIANTE;
  }

  /**
   * Indica si el estudiante es menor de edad en `fechaActual` (años cumplidos).
   * Determina si la atención psicológica requiere el consentimiento del
   * acudiente (línea base §4, R05/R06).
   */
  esMenorDeEdad(fechaActual: Date): boolean {
    const nacimiento = this.#fechaNacimiento;
    let edad = fechaActual.getFullYear() - nacimiento.getFullYear();
    const aunNoCumpleEsteAnio =
      fechaActual.getMonth() < nacimiento.getMonth() ||
      (fechaActual.getMonth() === nacimiento.getMonth() &&
        fechaActual.getDate() < nacimiento.getDate());
    if (aunNoCumpleEsteAnio) {
      edad -= 1;
    }
    return edad < EDAD_MAYORIA;
  }

  obtenerPrograma(): Programa {
    return this.#programa;
  }

  /**
   * Radica una solicitud de acompañamiento voluntario (R02, sd_CUD02).
   * El motivo es obligatorio (CUD02, flujo alterno 4.a).
   */
  solicitarAcompanamiento(
    tipoApoyo: RutaAtencion,
    motivo: string,
    disponibilidad: string,
  ): SolicitudAcompanamiento {
    if (motivo.trim() === '') {
      throw new Error('Describa el motivo de la solicitud');
    }
    return new SolicitudAcompanamiento({
      idOrigen: randomUUID(),
      fecha: new Date(),
      estado: EstadoOrigen.PENDIENTE,
      tipoApoyo,
      motivo,
      disponibilidad,
      estudiante: this,
    });
  }
}
