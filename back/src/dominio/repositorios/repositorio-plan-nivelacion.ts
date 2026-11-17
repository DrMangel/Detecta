import type { PlanNivelacion } from '../entidades/plan-nivelacion';
import type { Repositorio } from './repositorio';

/**
 * Contrato `RepositorioPlanNivelacion` (diagrama de clases v3). El periodo es
 * el de los cursos que el plan refuerza (decisión D12). `codigoPrograma` se
 * implementa como `idPrograma` (línea base §4).
 */
export interface RepositorioPlanNivelacion extends Repositorio<PlanNivelacion> {
  listarPorPeriodo(
    periodo: string,
    idPrograma: string,
  ): Promise<PlanNivelacion[]>;
}
