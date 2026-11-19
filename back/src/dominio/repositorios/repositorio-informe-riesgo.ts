import type { InformeRiesgo } from '../entidades/informe-riesgo';
import type { Persona } from '../entidades/persona';
import type { Repositorio } from './repositorio';

/**
 * Contrato `RepositorioInformeRiesgo` (fase B8, respuesta 4 de Ivan; NO está
 * en el diagrama de clases v3, que usa `Repositorio<InformeRiesgo>`: se
 * reporta como diferencia). Guarda el programa y el autor del informe
 * (asociación "genera" del diagrama de entidades) sin tocar la entidad.
 */
export interface RepositorioInformeRiesgo extends Repositorio<InformeRiesgo> {
  /**
   * Guarda el informe (con sus asociaciones "resume") junto con el programa
   * consultado y su autor: un Jefe de Departamento o un Psicólogo.
   */
  guardarConAutor(
    informe: InformeRiesgo,
    idPrograma: string,
    autor: Persona,
  ): Promise<void>;
  /** Programa de un informe guardado, o null si no existe. */
  buscarProgramaDelInforme(idInforme: string): Promise<string | null>;
}
