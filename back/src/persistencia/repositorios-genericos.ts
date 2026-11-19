import type { Asesoria } from '../dominio/entidades/asesoria';
import type { Cita } from '../dominio/entidades/cita';
import type { Curso } from '../dominio/entidades/curso';
import type { InformeRiesgo } from '../dominio/entidades/informe-riesgo';
import type { Persona } from '../dominio/entidades/persona';
import type { Programa } from '../dominio/entidades/programa';
import { Rol } from '../dominio/entidades/rol';
import type { RepositorioInformeRiesgo } from '../dominio/repositorios/repositorio-informe-riesgo';
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
import type { FuenteDatos } from './acceso-datos';
import { RepositorioPersistente } from './repositorio-persistente';

/*
 * Instancias de RepositorioPersistente<T> sin subclase propia, para las
 * entidades sin contrato especializado (ajuste A de Ivan en el plan de B2).
 */

/** guardar(programa): escribe solo el programa. */
export function crearRepositorioPrograma(
  fuente: FuenteDatos,
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
  fuente: FuenteDatos,
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
  fuente: FuenteDatos,
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
  fuente: FuenteDatos,
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
 * Adaptador de `RepositorioInformeRiesgo` (B8). guardar(informe) escribe el
 * informe y en cascada sus asociaciones "resume"; guardarConAutor agrega el
 * programa y el autor. No escribe el curso, los casos ni los planes.
 */
export class RepositorioPersistenteInformeRiesgo
  extends RepositorioPersistente<InformeRiesgo>
  implements RepositorioInformeRiesgo
{
  constructor(fuente: FuenteDatos) {
    super(fuente, {
      objetivo: EsquemaInformeRiesgo,
      propiedadId: 'idInforme',
      criterios: { periodo: 'periodo' },
      cargar: (cargador, ids) => cargador.informes(ids),
      escribir: (m, informe) => escribirInforme(m, informe),
    });
  }

  async guardarConAutor(
    informe: InformeRiesgo,
    idPrograma: string,
    autor: Persona,
  ): Promise<void> {
    const rol = autor.obtenerRol();
    if (rol !== Rol.JEFE_DEPARTAMENTO && rol !== Rol.PSICOLOGO) {
      throw new Error(
        'Solo un Jefe de Departamento o un Psicólogo genera informes',
      );
    }
    await this.acceso.transaccion((manager) =>
      escribirInforme(manager, informe, {
        idPrograma,
        idJefe: rol === Rol.JEFE_DEPARTAMENTO ? autor.id : null,
        idPsicologo: rol === Rol.PSICOLOGO ? autor.id : null,
      }),
    );
  }

  async buscarProgramaDelInforme(idInforme: string): Promise<string | null> {
    const [fila] = await this.acceso.query<{ id_programa: string }[]>(
      'SELECT id_programa FROM informe_riesgo WHERE id_informe = $1',
      [idInforme],
    );
    return fila?.id_programa ?? null;
  }
}

export function crearRepositorioInformeRiesgo(
  fuente: FuenteDatos,
): RepositorioPersistenteInformeRiesgo {
  return new RepositorioPersistenteInformeRiesgo(fuente);
}
