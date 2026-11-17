import type { CasoRiesgo } from '../entidades/caso-riesgo';
import type { Repositorio } from './repositorio';

/**
 * Contrato `RepositorioCasoRiesgo` (diagrama de clases v3). `codigoPrograma`
 * se implementa como `idPrograma` (línea base §4).
 */
export interface RepositorioCasoRiesgo extends Repositorio<CasoRiesgo> {
  /** Bandeja del Jefe (sd_CUD04): casos PENDIENTE sin ruta del programa. */
  listarPendientesPorPrograma(idPrograma: string): Promise<CasoRiesgo[]>;
  /** Casos con ruta PSICOLOGICA en estado PENDIENTE (sd_CUD06). */
  listarPendientesRutaPsicologica(): Promise<CasoRiesgo[]>;
  /** Casos asignados al psicólogo (sd_CUD06). */
  listarPorPsicologo(idPsicologo: string): Promise<CasoRiesgo[]>;
  /**
   * Casos cerrados o archivados (sd_CUD10) de alertas sobre cursos del
   * periodo, cuyo estudiante cursa el programa. El periodo es el del curso
   * (decisión D12): las solicitudes voluntarias no aparecen.
   */
  listarPorPeriodo(periodo: string, idPrograma: string): Promise<CasoRiesgo[]>;
}
