import type { CasoRiesgo } from './caso-riesgo';
import type { Curso } from './curso';
import { EstadoPlan } from './estado-plan';
import type { Estudiante } from './estudiante';

export interface PropiedadesPlanNivelacion {
  idPlan: string;
  descripcion: string;
  fecha: Date;
  cronograma: string;
  tutorNombre: string;
  tutorCodigo: string;
  estado: EstadoPlan;
  /** Caso del que nace (asociación "nace de", 1). */
  caso: CasoRiesgo;
  /** Cursos que refuerza (asociación "refuerza", 1..*). */
  cursos: readonly Curso[];
}

/**
 * Entidad `PlanNivelacion` (R04). El tutor es un dato informativo
 * (`tutorNombre`, `tutorCodigo`) sin validación ni gestión de tutorías
 * (línea base §4).
 */
export class PlanNivelacion {
  readonly #idPlan: string;
  readonly #descripcion: string;
  readonly #fecha: Date;
  readonly #cronograma: string;
  readonly #tutorNombre: string;
  readonly #tutorCodigo: string;
  #estado: EstadoPlan;
  readonly #caso: CasoRiesgo;
  readonly #cursos: Curso[];

  constructor(propiedades: PropiedadesPlanNivelacion) {
    if (propiedades.cursos.length === 0) {
      throw new Error('El plan de nivelación debe reforzar al menos un curso');
    }
    this.#idPlan = propiedades.idPlan;
    this.#descripcion = propiedades.descripcion;
    this.#fecha = new Date(propiedades.fecha);
    this.#cronograma = propiedades.cronograma;
    this.#tutorNombre = propiedades.tutorNombre;
    this.#tutorCodigo = propiedades.tutorCodigo;
    this.#estado = propiedades.estado;
    this.#caso = propiedades.caso;
    this.#cursos = [...propiedades.cursos];
  }

  get idPlan(): string {
    return this.#idPlan;
  }

  get descripcion(): string {
    return this.#descripcion;
  }

  get fecha(): Date {
    return new Date(this.#fecha);
  }

  get cronograma(): string {
    return this.#cronograma;
  }

  get tutorNombre(): string {
    return this.#tutorNombre;
  }

  get tutorCodigo(): string {
    return this.#tutorCodigo;
  }

  get estado(): EstadoPlan {
    return this.#estado;
  }

  get caso(): CasoRiesgo {
    return this.#caso;
  }

  get cursos(): readonly Curso[] {
    return [...this.#cursos];
  }

  obtenerEstudiante(): Estudiante {
    return this.#caso.obtenerEstudiante();
  }

  /** Extensión 1.a de CUD05 (nota de sd_CUD04): el Jefe finaliza un plan activo. */
  finalizar(): void {
    if (!this.estaActivo()) {
      throw new Error('El plan de nivelación ya está finalizado');
    }
    this.#estado = EstadoPlan.FINALIZADO;
  }

  estaActivo(): boolean {
    return this.#estado === EstadoPlan.ACTIVO;
  }
}
