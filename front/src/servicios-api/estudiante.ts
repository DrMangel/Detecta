import { pedir } from './cliente';

/*
 * Rutas del Estudiante (F1). Contrato tomado de ControladorConsultaEstudiante
 * y ControladorSolicitudes (B6; back/src/controladores/respuestas.ts). La
 * identidad sale siempre de la sesión: ninguna petición lleva el id del
 * estudiante (ER 3.5.3).
 */

/** Valores del enumerado NivelRiesgo (diagrama de clases v3). */
export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO';
/** Valores del enumerado RutaAtencion; en la solicitud, el tipo de apoyo. */
export type TipoApoyo = 'ACADEMICA' | 'PSICOLOGICA';
/** Estado de atención derivado del caso (D27). */
export type EstadoAtencion = 'PENDIENTE' | 'ATENDIDA';

export interface RegistroEstudiante {
  idRegistro: string;
  curso: { idCurso: string; nombre: string; periodo: string };
  nota: number;
  porcentajeAsistencia: number;
  /** null si el curso no se ha sincronizado (ER 3.3.5). */
  ultimaSincronizacion: string | null;
}

/** GET /consulta/registros: `mensaje` llega cuando no hay registros. */
export interface RegistrosEstudiante {
  registros: RegistroEstudiante[];
  mensaje?: string;
}

/** Alerta sobre el estudiante, sin el docente que la emitió (§7, B6). */
export interface AlertaEstudiante {
  idAlerta: string;
  fecha: string;
  curso: string;
  nivelRiesgo: NivelRiesgo;
  descripcion: string;
}

/** Solicitud y comprobante; `codigo` es el idOrigen (D28). */
export interface Solicitud {
  codigo: string;
  fecha: string;
  tipoApoyo: TipoApoyo;
  motivo: string;
  disponibilidad: string;
  estado: EstadoAtencion;
}

export interface DatosSolicitud {
  tipoApoyo: TipoApoyo;
  motivo: string;
  disponibilidad: string;
}

/**
 * Único 403 de POST /solicitudes cuyo texto se muestra (D21; respuesta 4 de
 * F1). Texto del backend (MENSAJES_SOLICITUDES.sinMatricula).
 */
export const TEXTO_SIN_MATRICULA =
  'No se encontró una matrícula activa asociada a su cuenta.';

function conPeriodo(ruta: string, periodo: string): string {
  return `${ruta}?periodo=${encodeURIComponent(periodo)}`;
}

/** CUD01: notas, asistencia y última sincronización del periodo. */
export function consultarRegistros(
  periodo: string,
): Promise<RegistrosEstudiante> {
  return pedir<RegistrosEstudiante>({
    metodo: 'GET',
    ruta: conPeriodo('/consulta/registros', periodo),
  });
}

/** CUD01 2.a: alertas emitidas sobre el estudiante en el periodo. */
export function consultarAlertas(periodo: string): Promise<AlertaEstudiante[]> {
  return pedir<AlertaEstudiante[]>({
    metodo: 'GET',
    ruta: conPeriodo('/consulta/alertas', periodo),
  });
}

/** CUD01 2.b: solicitudes del estudiante con su estado (D27). */
export function consultarSolicitudes(): Promise<Solicitud[]> {
  return pedir<Solicitud[]>({ metodo: 'GET', ruta: '/consulta/solicitudes' });
}

/** CUD02: registra la solicitud; el 201 es el comprobante. */
export function registrarSolicitud(datos: DatosSolicitud): Promise<Solicitud> {
  return pedir<Solicitud>({
    metodo: 'POST',
    ruta: '/solicitudes',
    cuerpo: datos,
    textos403: [TEXTO_SIN_MATRICULA],
  });
}
