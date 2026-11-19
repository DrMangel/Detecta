import { buscarNueva } from '../../servicios-api/conciliacion';
import type { DatosSolicitud, Solicitud } from '../../servicios-api/estudiante';

/*
 * Criterio de conciliación de la solicitud (plan de F1, sección i; ajuste C):
 * una solicitud nueva (código que no estaba) con el mismo tipo, motivo y
 * disponibilidad es la que se envió. El backend guarda el motivo y la
 * disponibilidad tal cual llegan (leerTexto solo recorta para validar).
 *
 * Límite conocido: dos solicitudes idénticas enviadas a la vez desde dos
 * pestañas se verían como una; no genera duplicados por sí mismo.
 */
export function buscarRegistrada(
  codigosPrevios: ReadonlySet<string>,
  lista: readonly Solicitud[],
  datos: DatosSolicitud,
): Solicitud | null {
  return buscarNueva(codigosPrevios, lista, {
    clave: (solicitud) => solicitud.codigo,
    coincide: (solicitud) =>
      solicitud.tipoApoyo === datos.tipoApoyo &&
      solicitud.motivo === datos.motivo &&
      solicitud.disponibilidad === datos.disponibilidad,
  });
}
