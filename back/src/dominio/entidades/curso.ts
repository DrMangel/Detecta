import type { Estudiante } from './estudiante';

export interface PropiedadesCurso {
  idCurso: string;
  nombre: string;
  periodo: string;
  /** `null` mientras el curso no se haya sincronizado nunca. */
  ultimaSincronizacion: Date | null;
  /** Estudiantes inscritos (asociación Estudiante–Curso con `RegistroAcademico`). */
  estudiantes: readonly Estudiante[];
}

/**
 * Entidad `Curso`. Lo configura el responsable del despliegue y se sincroniza
 * desde la BD institucional (línea base §4).
 */
export class Curso {
  readonly #idCurso: string;
  readonly #nombre: string;
  readonly #periodo: string;
  #ultimaSincronizacion: Date | null;
  readonly #estudiantes: Estudiante[];

  constructor(propiedades: PropiedadesCurso) {
    this.#idCurso = propiedades.idCurso;
    this.#nombre = propiedades.nombre;
    this.#periodo = propiedades.periodo;
    this.#ultimaSincronizacion = propiedades.ultimaSincronizacion
      ? new Date(propiedades.ultimaSincronizacion)
      : null;
    this.#estudiantes = [...propiedades.estudiantes];
  }

  get idCurso(): string {
    return this.#idCurso;
  }

  get nombre(): string {
    return this.#nombre;
  }

  get periodo(): string {
    return this.#periodo;
  }

  get ultimaSincronizacion(): Date | null {
    return this.#ultimaSincronizacion
      ? new Date(this.#ultimaSincronizacion)
      : null;
  }

  /** Estudiantes del curso, sin repetidos. */
  obtenerEstudiantes(): Estudiante[] {
    const vistos = new Set<string>();
    return this.#estudiantes.filter((estudiante) => {
      if (vistos.has(estudiante.id)) {
        return false;
      }
      vistos.add(estudiante.id);
      return true;
    });
  }

  /** Registra el momento de la última sincronización con la BD institucional (B4). */
  marcarSincronizado(fechaHora: Date): void {
    this.#ultimaSincronizacion = new Date(fechaHora);
  }
}
