import type { Curso } from './curso';
import type { Estudiante } from './estudiante';

export interface PropiedadesRegistroAcademico {
  idRegistro: string;
  nota: number;
  porcentajeAsistencia: number;
  estudiante: Estudiante;
  curso: Curso;
}

const NOTA_MINIMA = 0;
const NOTA_MAXIMA = 5;
const ASISTENCIA_MINIMA = 0;
const ASISTENCIA_MAXIMA = 100;

/**
 * Clase de asociación `RegistroAcademico` entre Estudiante y Curso, de solo
 * lectura: se sincroniza desde la BD institucional (diagrama de entidades).
 * Rangos válidos según la Tabla 2 del ER: calificación 0.00 a 5.00 y
 * asistencia 0.00 a 100.00.
 */
export class RegistroAcademico {
  readonly #idRegistro: string;
  readonly #nota: number;
  readonly #porcentajeAsistencia: number;
  readonly #estudiante: Estudiante;
  readonly #curso: Curso;

  constructor(propiedades: PropiedadesRegistroAcademico) {
    if (
      !Number.isFinite(propiedades.nota) ||
      propiedades.nota < NOTA_MINIMA ||
      propiedades.nota > NOTA_MAXIMA
    ) {
      throw new Error(
        `La nota debe estar entre ${NOTA_MINIMA} y ${NOTA_MAXIMA} (ER, Tabla 2)`,
      );
    }
    if (
      !Number.isFinite(propiedades.porcentajeAsistencia) ||
      propiedades.porcentajeAsistencia < ASISTENCIA_MINIMA ||
      propiedades.porcentajeAsistencia > ASISTENCIA_MAXIMA
    ) {
      throw new Error(
        `El porcentaje de asistencia debe estar entre ${ASISTENCIA_MINIMA} y ${ASISTENCIA_MAXIMA} (ER, Tabla 2)`,
      );
    }
    this.#idRegistro = propiedades.idRegistro;
    this.#nota = propiedades.nota;
    this.#porcentajeAsistencia = propiedades.porcentajeAsistencia;
    this.#estudiante = propiedades.estudiante;
    this.#curso = propiedades.curso;
  }

  get idRegistro(): string {
    return this.#idRegistro;
  }

  get nota(): number {
    return this.#nota;
  }

  get porcentajeAsistencia(): number {
    return this.#porcentajeAsistencia;
  }

  get estudiante(): Estudiante {
    return this.#estudiante;
  }

  get curso(): Curso {
    return this.#curso;
  }
}
