import {
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Alerta } from '../dominio/entidades/alerta';
import { EstadoCaso } from '../dominio/entidades/estado-caso';
import type { NivelRiesgo } from '../dominio/entidades/nivel-riesgo';
import type { RegistroAcademico } from '../dominio/entidades/registro-academico';
import type { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import type { SolicitudAcompanamiento } from '../dominio/entidades/solicitud-acompanamiento';

/*
 * Respuestas HTTP de B6: datos explícitos, nunca entidades completas,
 * hashes ni correos de terceros.
 */

/** sd_CUD01, flujo 4.a: sin datos sincronizados (ER 3.3.1). */
export const MENSAJE_INFORMACION_NO_DISPONIBLE = 'Información no disponible';
/** sd_CUD01, flujo *.a. */
export const MENSAJE_ERROR_CONSULTA = 'Error al consultar la información';

/**
 * Estado de atención que ven el estudiante y el docente (respuesta 4 de
 * Ivan): se deriva del caso al leer. PENDIENTE mientras el caso esté
 * PENDIENTE; ATENDIDA en cualquier otro estado. No se muestra ruta, avance
 * ni resultado. El estado guardado del origen no cambia (regla de B1).
 */
export type EstadoAtencion = 'PENDIENTE' | 'ATENDIDA';

export function estadoAtencion(
  estadoCaso: EstadoCaso | undefined,
): EstadoAtencion {
  return estadoCaso === undefined || estadoCaso === EstadoCaso.PENDIENTE
    ? 'PENDIENTE'
    : 'ATENDIDA';
}

export interface RegistroCursoDto {
  idRegistro: string;
  estudiante: { id: string; nombre: string };
  nota: number;
  porcentajeAsistencia: number;
}

export interface ConsultaCursoDto {
  curso: {
    idCurso: string;
    nombre: string;
    periodo: string;
    ultimaSincronizacion: string | null;
  };
  registros: RegistroCursoDto[];
  /** Solo si no hay registros sincronizados (sd_CUD01, 4.a). */
  mensaje?: string;
}

export interface RegistroEstudianteDto {
  idRegistro: string;
  curso: { idCurso: string; nombre: string; periodo: string };
  nota: number;
  porcentajeAsistencia: number;
  ultimaSincronizacion: string | null;
}

export interface RegistrosEstudianteDto {
  registros: RegistroEstudianteDto[];
  mensaje?: string;
}

/** Alerta vista por el estudiante (respuesta 10: sin el docente). */
export interface AlertaEstudianteDto {
  idAlerta: string;
  fecha: string;
  curso: string;
  nivelRiesgo: NivelRiesgo;
  descripcion: string;
}

/** Alerta vista por el docente que la emitió (sd_CUD01, 2.c). */
export interface AlertaEmitidaDto {
  idAlerta: string;
  fecha: string;
  curso: { idCurso: string; nombre: string };
  estudiante: { id: string; nombre: string };
  nivelRiesgo: NivelRiesgo;
  descripcion: string;
  estadoAtencion: EstadoAtencion;
}

/** Solicitud vista por su autor (sd_CUD01, 2.b); `codigo` = idOrigen (D28). */
export interface SolicitudDto {
  codigo: string;
  fecha: string;
  tipoApoyo: RutaAtencion;
  motivo: string;
  disponibilidad: string;
  estado: EstadoAtencion;
}

export function fechaIso(fecha: Date | null): string | null {
  return fecha === null ? null : fecha.toISOString();
}

export function registroCurso(registro: RegistroAcademico): RegistroCursoDto {
  return {
    idRegistro: registro.idRegistro,
    estudiante: {
      id: registro.estudiante.id,
      nombre: registro.estudiante.nombre,
    },
    nota: registro.nota,
    porcentajeAsistencia: registro.porcentajeAsistencia,
  };
}

export function registroEstudiante(
  registro: RegistroAcademico,
): RegistroEstudianteDto {
  return {
    idRegistro: registro.idRegistro,
    curso: {
      idCurso: registro.curso.idCurso,
      nombre: registro.curso.nombre,
      periodo: registro.curso.periodo,
    },
    nota: registro.nota,
    porcentajeAsistencia: registro.porcentajeAsistencia,
    ultimaSincronizacion: fechaIso(registro.curso.ultimaSincronizacion),
  };
}

export function alertaEstudiante(alerta: Alerta): AlertaEstudianteDto {
  return {
    idAlerta: alerta.idOrigen,
    fecha: alerta.fecha.toISOString(),
    curso: alerta.registro.curso.nombre,
    nivelRiesgo: alerta.nivelRiesgo,
    descripcion: alerta.descripcion,
  };
}

export function alertaEmitida(
  alerta: Alerta,
  estadoCaso: EstadoCaso | undefined,
): AlertaEmitidaDto {
  const estudiante = alerta.obtenerEstudiante();
  return {
    idAlerta: alerta.idOrigen,
    fecha: alerta.fecha.toISOString(),
    curso: {
      idCurso: alerta.registro.curso.idCurso,
      nombre: alerta.registro.curso.nombre,
    },
    estudiante: { id: estudiante.id, nombre: estudiante.nombre },
    nivelRiesgo: alerta.nivelRiesgo,
    descripcion: alerta.descripcion,
    estadoAtencion: estadoAtencion(estadoCaso),
  };
}

export function solicitud(
  origen: SolicitudAcompanamiento,
  estadoCaso: EstadoCaso | undefined,
): SolicitudDto {
  return {
    codigo: origen.idOrigen,
    fecha: origen.fecha.toISOString(),
    tipoApoyo: origen.tipoApoyo,
    motivo: origen.motivo,
    disponibilidad: origen.disponibilidad,
    estado: estadoAtencion(estadoCaso),
  };
}

/**
 * Ejecuta un acceso a la persistencia: los errores HTTP pasan tal cual; los
 * demás se registran solo por su nombre (sin datos) y se responden con 503 y
 * el mensaje de la secuencia (flujo *.a / 5.a).
 */
export async function conPersistencia<T>(
  registro: Logger,
  mensaje: string,
  trabajo: () => Promise<T>,
): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    registro.error(
      `${mensaje}: ${error instanceof Error ? error.name : 'error'}`,
    );
    throw new ServiceUnavailableException(mensaje);
  }
}
