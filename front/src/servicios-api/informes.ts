import { descargar, pedir } from './cliente';

/*
 * Informes de riesgo por asignatura (F3; CUD10, sd_CUD10). Contrato tomado
 * de ControladorInformes (B8). El Jefe no envía idPrograma: el backend usa
 * el programa que dirige. Solo datos agregados (R07).
 */

export interface Informe {
  idInforme: string;
  fecha: string;
  periodo: string;
  idPrograma: string;
  curso: { idCurso: string; nombre: string };
  totalAlertas: number;
  totalCasos: number;
  totalPlanes: number;
  resumen: string;
  /** Definición de cada total (texto del backend, plan de B8). */
  definiciones: {
    totalAlertas: string;
    totalCasos: string;
    totalPlanes: string;
  };
}

export interface FiltrosInforme {
  periodo: string;
  idCurso: string;
}

/** 201 con el informe, o 200 con el mensaje si no hay datos (sd_CUD10 3.a). */
export type ResultadoInforme = { informe: Informe } | { mensaje: string };

export function generarInforme(
  filtros: FiltrosInforme,
): Promise<ResultadoInforme> {
  return pedir<ResultadoInforme>({
    metodo: 'POST',
    ruta: '/informes',
    cuerpo: filtros,
  });
}

/** sd_CUD10 paso 6: el PDF del informe. */
export function exportarInforme(idInforme: string): Promise<Blob> {
  return descargar(`/informes/${encodeURIComponent(idInforme)}/pdf`);
}
