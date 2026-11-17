import { Inject, Injectable } from '@nestjs/common';
import { aTextoFechaLocal } from './fechas-locales';
import type { Curso } from '../../dominio/entidades/curso';
import { Estudiante } from '../../dominio/entidades/estudiante';
import { RegistroAcademico } from '../../dominio/entidades/registro-academico';
import type { Repositorio } from '../../dominio/repositorios/repositorio';
import { REPOSITORIO_CURSO } from '../../dominio/repositorios/tokens';
import {
  CONECTOR_BD_INSTITUCIONAL,
  MENSAJES_TABLA_2,
  omisionesVacias,
  type ConectorBDInstitucional,
  type OmisionesLectura,
} from '../contratos/conector-bd-institucional';
import {
  UNIDAD_TRABAJO,
  type RepositoriosTransaccionales,
  type UnidadTrabajo,
} from '../contratos/unidad-trabajo';
import { RELOJ, type Reloj } from './servicio-autenticacion';

/** Bloqueo exclusivo: nocturna y manual nunca se cruzan (ajuste A de B4). */
export const BLOQUEO_SINCRONIZACION = 'detecta.sincronizacion';
export const MENSAJE_SINCRONIZACION_EN_CURSO =
  'Ya hay una sincronización en curso; intente más tarde.';

/** Resultado de una ejecución (fuera del diagrama: el diagrama devuelve Integer). */
export interface ResultadoSincronizacion {
  cursos: string[];
  actualizados: number;
  omitidos: number;
  desglose: OmisionesLectura;
  mensajes: string[];
}

/** Mensajes de la Tabla 2 del ER y el aprobado por Ivan (respuesta 3). */
export function mensajesSincronizacion(
  actualizados: number,
  desglose: OmisionesLectura,
): string[] {
  const mensajes: string[] = [
    MENSAJES_TABLA_2.conexionEstablecida,
    `Sincronización completada: Se han actualizado ${actualizados} registros académicos en la persistencia del sistema.`,
  ];
  if (desglose.calificacionAsistencia > 0) {
    mensajes.push(
      `Advertencia de sincronización: Se omitieron ${desglose.calificacionAsistencia} registros debido a datos de calificación o asistencia fuera de rango.`,
    );
  }
  const otras =
    desglose.identificacion +
    desglose.correo +
    desglose.fechaNacimiento +
    desglose.programa +
    desglose.datosInconsistentesEstudiante;
  if (otras > 0) {
    mensajes.push(
      `Advertencia de sincronización: Se omitieron ${otras} registros por datos de identificación, correo, fecha de nacimiento o programa no válidos o no configurados.`,
    );
  }
  return mensajes;
}

/** Datos personales que deben coincidir en todas las filas de un estudiante. */
function firmaEstudiante(estudiante: Estudiante): string {
  return JSON.stringify([
    estudiante.nombre,
    estudiante.correo,
    aTextoFechaLocal(estudiante.fechaNacimiento),
    estudiante.obtenerPrograma().idPrograma,
  ]);
}

/**
 * Servicio `ServicioSincronizacion` (diagrama de clases v3:
 * `sincronizarCurso(idCurso): Integer`, `sincronizarTodo(): Integer`).
 *
 * Reglas (plan de B4 aprobado):
 * - Lee y valida TODAS las filas antes de escribir; las inválidas se omiten
 *   y se cuentan. Un mismo estudiante con datos personales distintos dentro
 *   de la ejecución omite todas sus filas (respuesta 13).
 * - Una sola transacción por ejecución (`UnidadTrabajo`, ER 3.7 a): solo se
 *   revierte ante fallos de infraestructura.
 * - Estudiante nuevo: cuenta sin activar (D6). Existente: se actualizan sus
 *   datos sin tocar el hash (regla de persistencia de B4). Correo que choca
 *   con otra persona: se omite.
 * - Nada se borra (D20): lo que deja de venir en la fuente se queda.
 */
@Injectable()
export class ServicioSincronizacion {
  #ultimoResultado: ResultadoSincronizacion | null = null;

  constructor(
    @Inject(CONECTOR_BD_INSTITUCIONAL)
    private readonly conector: ConectorBDInstitucional,
    @Inject(UNIDAD_TRABAJO)
    private readonly unidadTrabajo: UnidadTrabajo,
    @Inject(REPOSITORIO_CURSO)
    private readonly cursos: Repositorio<Curso>,
    @Inject(RELOJ)
    private readonly reloj: Reloj,
  ) {}

  async sincronizarCurso(idCurso: string): Promise<number> {
    return (await this.#ejecutar([idCurso])).actualizados;
  }

  async sincronizarTodo(): Promise<number> {
    const cursos = await this.cursos.listar(new Map());
    return (await this.#ejecutar(cursos.map((curso) => curso.idCurso)))
      .actualizados;
  }

  /** Detalle de la última ejecución (fuera del diagrama; lo usan el controlador y el comando). */
  obtenerUltimoResultado(): ResultadoSincronizacion | null {
    return this.#ultimoResultado;
  }

  async #ejecutar(idsCursos: string[]): Promise<ResultadoSincronizacion> {
    const resultado = await this.unidadTrabajo.ejecutar(
      (repositorios) => this.#sincronizar(idsCursos, repositorios),
      { bloqueoExclusivo: BLOQUEO_SINCRONIZACION },
    );
    this.#ultimoResultado = resultado;
    return resultado;
  }

  async #sincronizar(
    idsCursos: string[],
    repositorios: RepositoriosTransaccionales,
  ): Promise<ResultadoSincronizacion> {
    await this.conector.conectar();
    const desglose = omisionesVacias();

    // 1. Leer y validar todo antes de escribir.
    const lecturas: { idCurso: string; registros: RegistroAcademico[] }[] = [];
    for (const idCurso of idsCursos) {
      const registros = await this.conector.obtenerRegistros(idCurso);
      sumar(desglose, this.conector.omisionesUltimaLectura());
      lecturas.push({ idCurso, registros });
    }

    // 2. Consistencia de cada estudiante en TODA la ejecución (respuesta 13).
    const firmas = new Map<string, Set<string>>();
    const filasPorEstudiante = new Map<string, number>();
    for (const { registros } of lecturas) {
      for (const { estudiante } of registros) {
        const firmasDe = firmas.get(estudiante.id) ?? new Set<string>();
        firmasDe.add(firmaEstudiante(estudiante));
        firmas.set(estudiante.id, firmasDe);
        filasPorEstudiante.set(
          estudiante.id,
          (filasPorEstudiante.get(estudiante.id) ?? 0) + 1,
        );
      }
    }
    const omitidos = new Map<string, keyof OmisionesLectura>();
    for (const [id, firmasDe] of firmas) {
      if (firmasDe.size > 1) {
        omitidos.set(id, 'datosInconsistentesEstudiante');
      }
    }
    for (const { registros } of lecturas) {
      const vistos = new Set<string>();
      for (const { estudiante } of registros) {
        // Dos filas del mismo estudiante en el mismo curso: inconsistentes.
        if (vistos.has(estudiante.id)) {
          omitidos.set(estudiante.id, 'datosInconsistentesEstudiante');
        }
        vistos.add(estudiante.id);
      }
    }

    // 3. Escribir estudiantes (uno por id).
    const estudiantes = new Map<string, Estudiante>();
    for (const { registros } of lecturas) {
      for (const { estudiante } of registros) {
        if (!omitidos.has(estudiante.id)) {
          estudiantes.set(estudiante.id, estudiante);
        }
      }
    }
    const correosAsignados = new Map<string, string>();
    for (const estudiante of estudiantes.values()) {
      const existente = await repositorios.personas.buscarPorId(estudiante.id);
      if (existente !== null && !(existente instanceof Estudiante)) {
        omitidos.set(estudiante.id, 'identificacion');
        continue;
      }
      const duenoCorreo = await repositorios.personas.buscarPorCorreo(
        estudiante.correo,
      );
      const otroEnEstaEjecucion = correosAsignados.get(estudiante.correo);
      if (
        (duenoCorreo !== null && duenoCorreo.id !== estudiante.id) ||
        (otroEnEstaEjecucion !== undefined &&
          otroEnEstaEjecucion !== estudiante.id)
      ) {
        omitidos.set(estudiante.id, 'correo');
        continue;
      }
      correosAsignados.set(estudiante.correo, estudiante.id);
      await repositorios.personas.guardar(estudiante);
    }
    for (const [id, causa] of omitidos) {
      desglose[causa] += filasPorEstudiante.get(id) ?? 0;
    }

    // 4. Escribir registros (reutiliza el id del registro existente) y marcar
    //    cada curso como sincronizado.
    let actualizados = 0;
    const ahora = this.reloj();
    for (const { idCurso, registros } of lecturas) {
      const existentes = new Map(
        (await repositorios.registros.listarPorCurso(idCurso)).map((r) => [
          r.estudiante.id,
          r.idRegistro,
        ]),
      );
      for (const registro of registros) {
        const estudiante = estudiantes.get(registro.estudiante.id);
        if (estudiante === undefined || omitidos.has(estudiante.id)) {
          continue;
        }
        await repositorios.registros.guardar(
          new RegistroAcademico({
            idRegistro: existentes.get(estudiante.id) ?? registro.idRegistro,
            nota: registro.nota,
            porcentajeAsistencia: registro.porcentajeAsistencia,
            estudiante,
            curso: registro.curso,
          }),
        );
        actualizados += 1;
      }
      const curso = await repositorios.cursos.buscarPorId(idCurso);
      if (curso !== null) {
        curso.marcarSincronizado(ahora);
        await repositorios.cursos.guardar(curso);
      }
    }

    const totalOmitidos = Object.values(desglose).reduce((a, b) => a + b, 0);
    return {
      cursos: idsCursos,
      actualizados,
      omitidos: totalOmitidos,
      desglose,
      mensajes: mensajesSincronizacion(actualizados, desglose),
    };
  }
}

function sumar(destino: OmisionesLectura, origen: OmisionesLectura): void {
  for (const clave of Object.keys(destino) as (keyof OmisionesLectura)[]) {
    destino[clave] += origen[clave];
  }
}
