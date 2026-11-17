import type { Alerta } from '../entidades/alerta';
import type { Repositorio } from './repositorio';

/**
 * Contrato `RepositorioAlerta` (diagrama de clases v3). El periodo es el del
 * curso del registro que sustenta la alerta (decisión D12). `codigoPrograma`
 * se implementa como `idPrograma` (línea base §4).
 */
export interface RepositorioAlerta extends Repositorio<Alerta> {
  listarPorDocente(idDocente: string, periodo: string): Promise<Alerta[]>;
  listarPorEstudiante(idEstudiante: string, periodo: string): Promise<Alerta[]>;
  listarPorCurso(
    idCurso: string,
    periodo: string,
    idPrograma: string,
  ): Promise<Alerta[]>;
}
