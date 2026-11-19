import { pedir } from './cliente';
import type { EstadoAtencion, NivelRiesgo } from './estudiante';

/*
 * Rutas del Docente (F2). Contrato tomado de ControladorAlertas (B6;
 * back/src/controladores/respuestas.ts y README, sección B6). El docente sale
 * de la sesión; ninguna petición lleva su id.
 *
 * `estudiante.id` llega en las respuestas pero el front nunca lo muestra ni
 * lo deja en el DOM (ajuste C de F2): solo se usa en memoria para conciliar
 * tras un error de red.
 */

export interface RegistroCurso {
  idRegistro: string;
  estudiante: { id: string; nombre: string };
  nota: number;
  porcentajeAsistencia: number;
}

/** GET /alertas/cursos/:idCurso; `mensaje` llega si no hay registros. */
export interface ConsultaCurso {
  curso: {
    idCurso: string;
    nombre: string;
    periodo: string;
    /** null si el curso nunca se ha sincronizado (ER 3.3.1). */
    ultimaSincronizacion: string | null;
  };
  registros: RegistroCurso[];
  mensaje?: string;
}

/** Alerta vista por el docente que la emitió (sd_CUD01, 2.c). */
export interface AlertaEmitida {
  idAlerta: string;
  fecha: string;
  curso: { idCurso: string; nombre: string };
  estudiante: { id: string; nombre: string };
  nivelRiesgo: NivelRiesgo;
  descripcion: string;
  estadoAtencion: EstadoAtencion;
}

export interface DatosAlerta {
  idRegistro: string;
  nivelRiesgo: NivelRiesgo;
  descripcion: string;
}

/**
 * Textos de 403 de los diagramas que estas rutas muestran (respuesta 2 de
 * F2). Si el backend cambia uno de ellos, el front debe cambiar con él.
 */
export const TEXTO_CURSO_AJENO = 'El curso no está asignado al docente';
export const TEXTO_REGISTRO_AJENO =
  'El estudiante no pertenece a un curso asignado';

/** CUD01 (Docente): listado del curso con notas, asistencia y sincronización. */
export function consultarCurso(idCurso: string): Promise<ConsultaCurso> {
  return pedir<ConsultaCurso>({
    metodo: 'GET',
    ruta: `/alertas/cursos/${encodeURIComponent(idCurso)}`,
    textos403: [TEXTO_CURSO_AJENO],
  });
}

/** CUD01 2.c: alertas emitidas por el docente en el periodo. */
export function consultarAlertasEmitidas(
  periodo: string,
): Promise<AlertaEmitida[]> {
  return pedir<AlertaEmitida[]>({
    metodo: 'GET',
    ruta: `/alertas/emitidas?periodo=${encodeURIComponent(periodo)}`,
  });
}

/** CUD03: emite la alerta; el 201 trae el mensaje y la alerta. */
export function emitirAlerta(
  datos: DatosAlerta,
): Promise<{ mensaje: string; alerta: AlertaEmitida }> {
  return pedir<{ mensaje: string; alerta: AlertaEmitida }>({
    metodo: 'POST',
    ruta: '/alertas',
    cuerpo: datos,
    textos403: [TEXTO_REGISTRO_AJENO],
  });
}
