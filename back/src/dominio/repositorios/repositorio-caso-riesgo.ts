import type { CasoRiesgo } from '../entidades/caso-riesgo';
import type { EstadoCaso } from '../entidades/estado-caso';
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
  /**
   * Estado del caso generado por cada origen, en UNA consulta para todos los
   * orígenes (B6, respuesta 4 de Ivan: el estado que ven el estudiante y el
   * docente se deriva del caso al leer). NO está en el diagrama de clases
   * v3: se reporta como diferencia. Los orígenes sin caso no aparecen.
   */
  /**
   * Caso visible para el Jefe de Departamento (B7, ajuste A de Ivan; NO está
   * en el diagrama): del programa que dirige y NUNCA de una solicitud
   * psicosocial (ruta psicológica desde su nacimiento). La exclusión se hace
   * en la consulta. Devuelve null si el caso no existe o no es visible.
   */
  buscarParaPrograma(
    idCaso: string,
    idPrograma: string,
  ): Promise<CasoRiesgo | null>;
  listarEstadosPorOrigen(
    idsOrigen: readonly string[],
  ): Promise<Map<string, EstadoCaso>>;
}
