import type { DataSource } from 'typeorm';
import {
  RecursoOcupadoError,
  type OpcionesUnidadTrabajo,
  type RepositoriosTransaccionales,
  type UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import { crearRepositorioCurso } from './repositorios-genericos';
import {
  RepositorioPersistentePersona,
  RepositorioPersistenteRegistroAcademico,
} from './repositorios-persistentes';

/**
 * Adaptador de `UnidadTrabajo` (B4; fuera del diagrama, aprobado por Ivan).
 * Abre una transacción y entrega repositorios ligados a su EntityManager:
 * todo se confirma o se revierte junto (ER 3.7 a).
 */
export class UnidadTrabajoPersistente implements UnidadTrabajo {
  constructor(private readonly fuente: DataSource) {}

  ejecutar<R>(
    trabajo: (repositorios: RepositoriosTransaccionales) => Promise<R>,
    opciones: OpcionesUnidadTrabajo = {},
  ): Promise<R> {
    return this.fuente.transaction(async (manager) => {
      if (opciones.bloqueoExclusivo) {
        // Bloqueo de la transacción: se libera solo al confirmar o revertir.
        const [fila] = await manager.query<{ obtenido: boolean }[]>(
          'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS obtenido',
          [opciones.bloqueoExclusivo],
        );
        if (fila?.obtenido !== true) {
          throw new RecursoOcupadoError(
            `El recurso "${opciones.bloqueoExclusivo}" está en uso`,
          );
        }
      }
      return trabajo({
        personas: new RepositorioPersistentePersona(manager),
        registros: new RepositorioPersistenteRegistroAcademico(manager),
        cursos: crearRepositorioCurso(manager),
      });
    });
  }
}
