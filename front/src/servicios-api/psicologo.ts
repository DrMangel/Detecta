import { pedir } from './cliente';

/* Contratos del Psicólogo: ControladoresAtencionPsicologica y Pertinencia. */

export type EstadoCaso =
  | 'PENDIENTE'
  | 'EN_NIVELACION'
  | 'EN_EVALUACION'
  | 'CITADO'
  | 'EN_SEGUIMIENTO'
  | 'CERRADO'
  | 'ARCHIVADO'
  | 'REORIENTADO';

export type RutaAtencion = 'ACADEMICA' | 'PSICOLOGICA';
export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO';
export type Modalidad = 'PRESENCIAL' | 'VIRTUAL';
export type TipoAsesoria = 'ORIENTACION' | 'SEGUIMIENTO';
export type EstadoCita = 'PROGRAMADA' | 'REPROGRAMADA' | 'CERRADA';

export interface OrigenAlerta {
  tipo: 'ALERTA';
  idOrigen: string;
  fecha: string;
  curso: { idCurso: string; nombre: string; periodo: string };
  descripcion: string;
  registro: { nota: number; porcentajeAsistencia: number };
}

export interface OrigenSolicitud {
  tipo: 'SOLICITUD';
  idOrigen: string;
  fecha: string;
  tipoApoyo: RutaAtencion;
  motivo?: string;
  disponibilidad?: string;
}

export interface CasoPsicologo {
  idCaso: string;
  fechaCreacion: string;
  estado: EstadoCaso;
  ruta: RutaAtencion | null;
  nivelRiesgo: NivelRiesgo | null;
  estudiante: { id: string; nombre: string };
  origen: OrigenAlerta | OrigenSolicitud;
  justificacion: string;
  consentimientoConfirmado: boolean;
  requiereConsentimiento: boolean;
  psicologo: { id: string; nombre: string } | null;
  presentaRiesgoCritico: boolean;
  citas: Cita[];
}

export interface Asesoria {
  idAsesoria: string;
  fecha: string;
  tipoAsesoria: TipoAsesoria;
  observaciones: string;
  acuerdos: string;
  asistencia: boolean;
  requiereSeguimiento: boolean;
  presentaRiesgoCritico: boolean;
}

export interface Cita {
  idCita: string;
  fechaHora: string;
  modalidad: Modalidad;
  estado: EstadoCita;
  asesoria: Asesoria | null;
}

export interface Antecedente {
  idRegistro: string;
  curso: { idCurso: string; nombre: string; periodo: string };
  nota: number;
  porcentajeAsistencia: number;
  ultimaSincronizacion: string | null;
}

export interface DetallePsicologo {
  caso: CasoPsicologo;
  antecedentes: Antecedente[];
}

export interface Dictamen {
  mensaje: string;
  estado: EstadoCaso;
}

export interface CitaEntrada {
  fechaHora: string;
  modalidad: Modalidad;
}

export interface ResultadoEntrada {
  tipo: TipoAsesoria;
  observaciones: string;
  acuerdos: string;
  asistencia: boolean;
  requiereSeguimiento: boolean;
  presentaRiesgoCritico: boolean;
}

export interface RespuestaCita {
  cita: Cita;
}

export interface DatosDictamen {
  idCaso: string;
  pertinente: boolean;
  justificacion: string;
  reorientar?: boolean;
}

const rutaCaso = (idCaso: string) =>
  `/atencion/casos/${encodeURIComponent(idCaso)}`;

export function consultarCasosPsicologo(): Promise<CasoPsicologo[]> {
  return pedir<CasoPsicologo[]>({ metodo: 'GET', ruta: '/atencion/casos' });
}

export function consultarCasoPsicologo(
  idCaso: string,
): Promise<DetallePsicologo> {
  return pedir<DetallePsicologo>({ metodo: 'GET', ruta: rutaCaso(idCaso) });
}

export function evaluarPertinencia(datos: DatosDictamen): Promise<Dictamen> {
  return pedir<Dictamen>({
    metodo: 'POST',
    ruta: `/pertinencia/${encodeURIComponent(datos.idCaso)}`,
    cuerpo: {
      pertinente: datos.pertinente,
      justificacion: datos.justificacion,
      ...(datos.reorientar === undefined
        ? {}
        : { reorientar: datos.reorientar }),
    },
  });
}

export function confirmarConsentimiento(
  idCaso: string,
): Promise<{ consentimientoConfirmado: boolean }> {
  return pedir({ metodo: 'POST', ruta: `${rutaCaso(idCaso)}/consentimiento` });
}

export function programarPrimeraCita(
  idCaso: string,
  cuerpo: CitaEntrada,
): Promise<RespuestaCita> {
  return pedir({
    metodo: 'POST',
    ruta: `/pertinencia/${encodeURIComponent(idCaso)}/citas`,
    cuerpo,
  });
}

export function reprogramarCita(
  idCita: string,
  cuerpo: CitaEntrada,
): Promise<RespuestaCita> {
  return pedir({
    metodo: 'POST',
    ruta: `/atencion/citas/${encodeURIComponent(idCita)}/reprogramacion`,
    cuerpo,
  });
}

export function registrarResultado(
  idCaso: string,
  idCita: string,
  cuerpo: ResultadoEntrada,
): Promise<{ mensaje: string; cita: Cita }> {
  return pedir({
    metodo: 'POST',
    ruta: `${rutaCaso(idCaso)}/citas/${encodeURIComponent(idCita)}/resultado`,
    cuerpo,
  });
}

export function programarSeguimiento(
  idCaso: string,
  cuerpo: CitaEntrada,
): Promise<RespuestaCita> {
  return pedir({
    metodo: 'POST',
    ruta: `${rutaCaso(idCaso)}/seguimiento`,
    cuerpo,
  });
}

export function cerrarCaso(idCaso: string): Promise<{ mensaje: string }> {
  return pedir({ metodo: 'POST', ruta: `${rutaCaso(idCaso)}/cierre` });
}
