import type { SolicitudAcompanamiento } from '../entidades/solicitud-acompanamiento';
import type { Repositorio } from './repositorio';

/** Contrato `RepositorioSolicitud` (diagrama de clases v3). */
export interface RepositorioSolicitud extends Repositorio<SolicitudAcompanamiento> {
  listarPorEstudiante(idEstudiante: string): Promise<SolicitudAcompanamiento[]>;
}
