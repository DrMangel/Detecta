import type { DataSource } from 'typeorm';
import type { Asesoria } from '../dominio/entidades/asesoria';
import type { Cita } from '../dominio/entidades/cita';
import type { Curso } from '../dominio/entidades/curso';
import type { InformeRiesgo } from '../dominio/entidades/informe-riesgo';
import type { Programa } from '../dominio/entidades/programa';
import {
  EsquemaAsesoria,
  EsquemaCita,
  EsquemaCurso,
  EsquemaInformeRiesgo,
  EsquemaPrograma,
} from './esquemas';
import {
  escribirAsesoria,
  escribirCita,
  escribirCurso,
  escribirInforme,
  escribirPrograma,
} from './mapeadores/escritores';
import { RepositorioPersistente } from './repositorio-persistente';

/*
 * Instancias de RepositorioPersistente<T> sin subclase propia, para las
 * entidades sin contrato especializado (ajuste A de Ivan en el plan de B2).
 */

/** guardar(programa): escribe solo el programa. */
export function crearRepositorioPrograma(
  fuente: DataSource,
): RepositorioPersistente<Programa> {
  return new RepositorioPersistente<Programa>(fuente, {
    objetivo: EsquemaPrograma,
    propiedadId: 'idPrograma',
    criterios: { nombre: 'nombre' },
    cargar: (cargador, ids) => cargador.programas(ids),
    escribir: escribirPrograma,
  });
}

/**
 * guardar(curso): solo ACTUALIZA un curso existente. Los cursos se crean en
 * cascada desde guardar(docente), porque el curso no conoce a su docente.
 * No escribe sus estudiantes (salen de los registros académicos).
 */
export function crearRepositorioCurso(
  fuente: DataSource,
): RepositorioPersistente<Curso> {
  return new RepositorioPersistente<Curso>(fuente, {
    objetivo: EsquemaCurso,
    propiedadId: 'idCurso',
    criterios: { nombre: 'nombre', periodo: 'periodo' },
    cargar: (cargador, ids) => cargador.cursos(ids),
    escribir: escribirCurso,
  });
}

/**
 * guardar(cita): solo ACTUALIZA una cita existente y escribe en cascada su
 * asesoría. Las citas se crean desde guardar(caso).
 */
export function crearRepositorioCita(
  fuente: DataSource,
): RepositorioPersistente<Cita> {
  return new RepositorioPersistente<Cita>(fuente, {
    objetivo: EsquemaCita,
    propiedadId: 'idCita',
    criterios: { estado: 'estado', modalidad: 'modalidad' },
    cargar: (cargador, ids) => cargador.citas(ids),
    escribir: escribirCita,
  });
}

/**
 * guardar(asesoria): solo ACTUALIZA una asesoría existente. Las asesorías se
 * crean desde guardar(cita) o guardar(caso).
 */
export function crearRepositorioAsesoria(
  fuente: DataSource,
): RepositorioPersistente<Asesoria> {
  return new RepositorioPersistente<Asesoria>(fuente, {
    objetivo: EsquemaAsesoria,
    propiedadId: 'idAsesoria',
    criterios: { tipoAsesoria: 'tipoAsesoria' },
    cargar: (cargador, ids) => cargador.asesorias(ids),
    escribir: escribirAsesoria,
  });
}

/**
 * guardar(informe): escribe el informe y en cascada sus asociaciones
 * "resume" con casos y planes. No escribe el curso, los casos ni los planes.
 */
export function crearRepositorioInformeRiesgo(
  fuente: DataSource,
): RepositorioPersistente<InformeRiesgo> {
  return new RepositorioPersistente<InformeRiesgo>(fuente, {
    objetivo: EsquemaInformeRiesgo,
    propiedadId: 'idInforme',
    criterios: { periodo: 'periodo' },
    cargar: (cargador, ids) => cargador.informes(ids),
    escribir: escribirInforme,
  });
}
