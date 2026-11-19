import type { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import { Alerta } from '../dominio/entidades/alerta';
import type { CasoRiesgo } from '../dominio/entidades/caso-riesgo';
import type { Cita } from '../dominio/entidades/cita';
import type { EstadoCaso } from '../dominio/entidades/estado-caso';
import type { EstadoCita } from '../dominio/entidades/estado-cita';
import type { Modalidad } from '../dominio/entidades/modalidad';
import type { NivelRiesgo } from '../dominio/entidades/nivel-riesgo';
import type { Persona } from '../dominio/entidades/persona';
import type { RegistroAcademico } from '../dominio/entidades/registro-academico';
import type { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import type { SolicitudAcompanamiento } from '../dominio/entidades/solicitud-acompanamiento';
import type { TipoAsesoria } from '../dominio/entidades/tipo-asesoria';
import { registroEstudiante, type RegistroEstudianteDto } from './respuestas';

/*
 * Respuestas de B7 con la visibilidad aplicada (D18, D19; ER 3.5.3 y 3.7 c).
 * El contenido confidencial (motivo y disponibilidad de una solicitud;
 * expediente) solo se incluye si ControlAcceso.puedeVerContenidoConfidencial
 * lo permite. El expediente (citas y asesorías) y la justificación del
 * dictamen nunca van al Jefe.
 */

export interface OrigenAlertaDto {
  tipo: 'ALERTA';
  idOrigen: string;
  fecha: string;
  curso: { idCurso: string; nombre: string; periodo: string };
  /** Justificación del docente (no es contenido confidencial; CUD04 paso 3). */
  descripcion: string;
  registro: { nota: number; porcentajeAsistencia: number };
}

export interface OrigenSolicitudDto {
  tipo: 'SOLICITUD';
  idOrigen: string;
  fecha: string;
  tipoApoyo: RutaAtencion;
  /** Solo si el usuario puede ver el contenido confidencial (D18). */
  motivo?: string;
  disponibilidad?: string;
}

export interface CasoDto {
  idCaso: string;
  fechaCreacion: string;
  estado: EstadoCaso;
  ruta: RutaAtencion | null;
  nivelRiesgo: NivelRiesgo | null;
  estudiante: { id: string; nombre: string };
  origen: OrigenAlertaDto | OrigenSolicitudDto;
}

export interface AsesoriaDto {
  idAsesoria: string;
  fecha: string;
  tipoAsesoria: TipoAsesoria;
  observaciones: string;
  acuerdos: string;
  asistencia: boolean;
  requiereSeguimiento: boolean;
  presentaRiesgoCritico: boolean;
}

export interface CitaDto {
  idCita: string;
  fechaHora: string;
  modalidad: Modalidad;
  estado: EstadoCita;
  asesoria: AsesoriaDto | null;
}

/** Caso visto por el psicólogo (D19): con el expediente. */
export interface CasoPsicologoDto extends CasoDto {
  justificacion: string;
  consentimientoConfirmado: boolean;
  requiereConsentimiento: boolean;
  psicologo: { id: string; nombre: string } | null;
  /** CUD08 4.a: el riesgo crítico se resalta en el expediente. */
  presentaRiesgoCritico: boolean;
  citas: CitaDto[];
}

export interface DetalleDto<T> {
  caso: T;
  /** Antecedentes académicos del estudiante (CUD04 paso 3; CUD07 paso 1). */
  antecedentes: RegistroEstudianteDto[];
}

function origen(
  caso: CasoRiesgo,
  verContenido: boolean,
): OrigenAlertaDto | OrigenSolicitudDto {
  const fuente = caso.origen;
  if (fuente instanceof Alerta) {
    return {
      tipo: 'ALERTA',
      idOrigen: fuente.idOrigen,
      fecha: fuente.fecha.toISOString(),
      curso: {
        idCurso: fuente.registro.curso.idCurso,
        nombre: fuente.registro.curso.nombre,
        periodo: fuente.registro.curso.periodo,
      },
      descripcion: fuente.descripcion,
      registro: {
        nota: fuente.registro.nota,
        porcentajeAsistencia: fuente.registro.porcentajeAsistencia,
      },
    };
  }
  const solicitud = fuente as SolicitudAcompanamiento;
  return {
    tipo: 'SOLICITUD',
    idOrigen: solicitud.idOrigen,
    fecha: solicitud.fecha.toISOString(),
    tipoApoyo: solicitud.tipoApoyo,
    ...(verContenido
      ? { motivo: solicitud.motivo, disponibilidad: solicitud.disponibilidad }
      : {}),
  };
}

/** Caso visto por el Jefe: sin expediente ni justificación del dictamen. */
export function casoJefe(
  control: ControlAcceso,
  usuario: Persona,
  caso: CasoRiesgo,
): CasoDto {
  const estudiante = caso.obtenerEstudiante();
  return {
    idCaso: caso.idCaso,
    fechaCreacion: caso.fechaCreacion.toISOString(),
    estado: caso.estado,
    ruta: caso.ruta,
    nivelRiesgo: caso.nivelRiesgo,
    estudiante: { id: estudiante.id, nombre: estudiante.nombre },
    origen: origen(caso, control.puedeVerContenidoConfidencial(usuario, caso)),
  };
}

function cita(valor: Cita): CitaDto {
  const asesoria = valor.asesoria;
  return {
    idCita: valor.idCita,
    fechaHora: valor.fechaHora.toISOString(),
    modalidad: valor.modalidad,
    estado: valor.estado,
    asesoria:
      asesoria === null
        ? null
        : {
            idAsesoria: asesoria.idAsesoria,
            fecha: asesoria.fecha.toISOString(),
            tipoAsesoria: asesoria.tipoAsesoria,
            observaciones: asesoria.observaciones,
            acuerdos: asesoria.acuerdos,
            asistencia: asesoria.asistencia,
            requiereSeguimiento: asesoria.requiereSeguimiento,
            presentaRiesgoCritico: asesoria.presentaRiesgoCritico,
          },
  };
}

/**
 * Caso visto por un psicólogo que puede ver su contenido (D19). Quien llama
 * verifica antes `puedeVerContenidoConfidencial`.
 */
export function casoPsicologo(
  caso: CasoRiesgo,
  fechaActual: Date,
): CasoPsicologoDto {
  const estudiante = caso.obtenerEstudiante();
  const citas = [...caso.citas].sort(
    (a, b) => a.fechaHora.getTime() - b.fechaHora.getTime(),
  );
  return {
    idCaso: caso.idCaso,
    fechaCreacion: caso.fechaCreacion.toISOString(),
    estado: caso.estado,
    ruta: caso.ruta,
    nivelRiesgo: caso.nivelRiesgo,
    estudiante: { id: estudiante.id, nombre: estudiante.nombre },
    origen: origen(caso, true),
    justificacion: caso.justificacion,
    consentimientoConfirmado: caso.consentimientoConfirmado,
    requiereConsentimiento: caso.requiereConsentimiento(fechaActual),
    psicologo:
      caso.psicologo === null
        ? null
        : { id: caso.psicologo.id, nombre: caso.psicologo.nombre },
    presentaRiesgoCritico: citas.some(
      (valor) => valor.asesoria?.presentaRiesgoCritico === true,
    ),
    citas: citas.map(cita),
  };
}

export function antecedentes(
  registros: readonly RegistroAcademico[],
): RegistroEstudianteDto[] {
  return registros.map(registroEstudiante);
}

export { cita as citaDto };
