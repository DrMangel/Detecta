import type { Alerta } from './alerta';
import type { CasoRiesgo } from './caso-riesgo';
import type { Curso } from './curso';
import type { PlanNivelacion } from './plan-nivelacion';

export interface PropiedadesInformeRiesgo {
  idInforme: string;
  fecha: Date;
  periodo: string;
  totalAlertas: number;
  totalCasos: number;
  totalPlanes: number;
  resumen: string;
  /** Curso del que se reporta (asociación "reporta", 1). */
  curso: Curso;
  /** Casos que resume (asociación "resume"). */
  casos: readonly CasoRiesgo[];
  /** Planes que resume (asociación "resume"). */
  planes: readonly PlanNivelacion[];
  /**
   * Alertas del curso en el periodo. sd_CUD10: `GeneradorInformeRiesgo` las
   * obtiene con `RepositorioAlerta.listarPorCurso` antes de crear el informe.
   * El diagrama de entidades no asocia el informe con `Alerta`, así que solo
   * se usan para calcular `totalAlertas` en `consolidar()`.
   */
  alertas: readonly Alerta[];
}

/** Entidad `InformeRiesgo` por asignatura (R07, sd_CUD10). */
export class InformeRiesgo {
  readonly #idInforme: string;
  readonly #fecha: Date;
  readonly #periodo: string;
  #totalAlertas: number;
  #totalCasos: number;
  #totalPlanes: number;
  #resumen: string;
  readonly #curso: Curso;
  readonly #casos: CasoRiesgo[];
  readonly #planes: PlanNivelacion[];
  readonly #alertas: Alerta[];

  constructor(propiedades: PropiedadesInformeRiesgo) {
    this.#idInforme = propiedades.idInforme;
    this.#fecha = new Date(propiedades.fecha);
    this.#periodo = propiedades.periodo;
    this.#totalAlertas = propiedades.totalAlertas;
    this.#totalCasos = propiedades.totalCasos;
    this.#totalPlanes = propiedades.totalPlanes;
    this.#resumen = propiedades.resumen;
    this.#curso = propiedades.curso;
    this.#casos = [...propiedades.casos];
    this.#planes = [...propiedades.planes];
    this.#alertas = [...propiedades.alertas];
  }

  get idInforme(): string {
    return this.#idInforme;
  }

  get fecha(): Date {
    return new Date(this.#fecha);
  }

  get periodo(): string {
    return this.#periodo;
  }

  get totalAlertas(): number {
    return this.#totalAlertas;
  }

  get totalCasos(): number {
    return this.#totalCasos;
  }

  get totalPlanes(): number {
    return this.#totalPlanes;
  }

  get resumen(): string {
    return this.#resumen;
  }

  get curso(): Curso {
    return this.#curso;
  }

  get casos(): readonly CasoRiesgo[] {
    return [...this.#casos];
  }

  get planes(): readonly PlanNivelacion[] {
    return [...this.#planes];
  }

  /**
   * Calcula `totalAlertas`, `totalCasos`, `totalPlanes` y `resumen` (nota de
   * sd_CUD10). El texto del resumen es provisional (aprobado en el plan de B1).
   */
  consolidar(): void {
    this.#totalAlertas = this.#alertas.length;
    this.#totalCasos = this.#casos.length;
    this.#totalPlanes = this.#planes.length;
    this.#resumen = `Alertas: ${this.#totalAlertas}. Casos: ${this.#totalCasos}. Planes de nivelación: ${this.#totalPlanes}.`;
  }
}
