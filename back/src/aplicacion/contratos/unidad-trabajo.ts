import type { Curso } from '../../dominio/entidades/curso';
import type { Repositorio } from '../../dominio/repositorios/repositorio';
import type { RepositorioPersona } from '../../dominio/repositorios/repositorio-persona';
import type { RepositorioRegistroAcademico } from '../../dominio/repositorios/repositorio-registro-academico';

/**
 * Contrato `UnidadTrabajo` (aprobado por Ivan en el plan de B4; NO está en el
 * diagrama de clases v3: se reporta como diferencia).
 *
 * Manual 4.1.1.4: "los límites transaccionales los definen los servicios y no
 * los repositorios". El servicio recibe repositorios ligados a UNA
 * transacción: todo lo que guarda dentro de `ejecutar` se confirma junto o se
 * revierte junto (ER 3.7 a), y sus lecturas ven los cambios aún no
 * confirmados de la misma transacción.
 */
export interface RepositoriosTransaccionales {
  personas: RepositorioPersona;
  registros: RepositorioRegistroAcademico;
  cursos: Repositorio<Curso>;
}

export interface OpcionesUnidadTrabajo {
  /**
   * Bloqueo exclusivo por nombre (pg_try_advisory_xact_lock): si otra
   * transacción ya lo tiene, `ejecutar` lanza `RecursoOcupadoError` sin
   * esperar (ajuste A de Ivan en el plan de B4).
   */
  bloqueoExclusivo?: string;
}

export interface UnidadTrabajo {
  ejecutar<R>(
    trabajo: (repositorios: RepositoriosTransaccionales) => Promise<R>,
    opciones?: OpcionesUnidadTrabajo,
  ): Promise<R>;
}

export const UNIDAD_TRABAJO = Symbol('UnidadTrabajo');

/** El recurso bloqueado ya está en uso por otra transacción. */
export class RecursoOcupadoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'RecursoOcupadoError';
  }
}
