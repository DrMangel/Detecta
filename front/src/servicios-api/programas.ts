import { pedir } from './cliente';

/** Programa visible para el selector de informes del Psicólogo (B10). */
export interface ProgramaDisponible {
  idPrograma: string;
  nombre: string;
}

export function consultarProgramas(): Promise<ProgramaDisponible[]> {
  return pedir<ProgramaDisponible[]>({ metodo: 'GET', ruta: '/programas' });
}
