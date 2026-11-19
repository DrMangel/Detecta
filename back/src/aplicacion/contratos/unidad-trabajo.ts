import type { Asesoria } from '../../dominio/entidades/asesoria';
import type { Cita } from '../../dominio/entidades/cita';
import type { Curso } from '../../dominio/entidades/curso';
import type { Repositorio } from '../../dominio/repositorios/repositorio';
import type { RepositorioAlerta } from '../../dominio/repositorios/repositorio-alerta';
import type { RepositorioCasoRiesgo } from '../../dominio/repositorios/repositorio-caso-riesgo';
import type { RepositorioPersona } from '../../dominio/repositorios/repositorio-persona';
import type { RepositorioPlanNivelacion } from '../../dominio/repositorios/repositorio-plan-nivelacion';
import type { RepositorioRegistroAcademico } from '../../dominio/repositorios/repositorio-registro-academico';
import type { RepositorioSolicitud } from '../../dominio/repositorios/repositorio-solicitud';

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
  /**
   * B6 (respuesta 5 de Ivan): el origen (alerta o solicitud) y su caso se
   * guardan en la misma transacción, primero el origen y después el caso
   * (D7: el caso exige su origen).
   */
  alertas: RepositorioAlerta;
  solicitudes: RepositorioSolicitud;
  casos: RepositorioCasoRiesgo;
  /** B7: la cita y su asesoría se guardan junto con el caso. */
  citas: Repositorio<Cita>;
  asesorias: Repositorio<Asesoria>;
  /** B8: el plan de nivelación se guarda con bloqueo del caso o del plan. */
  planes: RepositorioPlanNivelacion;
}

export interface OpcionesUnidadTrabajo {
  /**
   * Bloqueo exclusivo por nombre (pg_try_advisory_xact_lock): si otra
   * transacción ya lo tiene, `ejecutar` lanza `RecursoOcupadoError` sin
   * esperar (ajuste A de Ivan en el plan de B4).
   */
  bloqueoExclusivo?: string;
  /**
   * B7 (respuesta 7 y ajuste B de Ivan): bloqueos CON ESPERA
   * (pg_advisory_xact_lock), tomados en el orden dado (el caso primero y la
   * agenda del psicólogo después, para evitar interbloqueos), en un espacio
   * de claves distinto del de `bloqueoExclusivo`. Si la espera supera el
   * `lock_timeout`, `ejecutar` lanza `BloqueoAgotadoError`.
   */
  bloqueos?: readonly string[];
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

/** Venció el tiempo de espera de un bloqueo (`lock_timeout`). */
export class BloqueoAgotadoError extends Error {
  constructor() {
    super('Venció la espera de un bloqueo');
    this.name = 'BloqueoAgotadoError';
  }
}
