import type { RegistroAcademico } from '../entidades/registro-academico';
import type { Repositorio } from './repositorio';

/**
 * Contrato `RepositorioRegistroAcademico` (diagrama de clases v3). El
 * periodo es el del curso (decisión D12).
 */
export interface RepositorioRegistroAcademico extends Repositorio<RegistroAcademico> {
  listarPorCurso(idCurso: string): Promise<RegistroAcademico[]>;
  listarPorEstudiante(
    idEstudiante: string,
    periodo: string,
  ): Promise<RegistroAcademico[]>;
}
