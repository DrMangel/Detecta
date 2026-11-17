import type { JefeDepartamento } from '../entidades/jefe-departamento';
import type { Persona } from '../entidades/persona';
import type { Rol } from '../entidades/rol';
import type { Repositorio } from './repositorio';

/**
 * Contrato `RepositorioPersona` (diagrama de clases v3). El parámetro
 * `codigoPrograma` del diagrama se implementa como `idPrograma` (línea base §4).
 */
export interface RepositorioPersona extends Repositorio<Persona> {
  buscarPorCorreo(correo: string): Promise<Persona | null>;
  listarPorRol(rol: Rol): Promise<Persona[]>;
  buscarJefePorPrograma(idPrograma: string): Promise<JefeDepartamento | null>;
}
