import type { DatosSolicitud, Solicitud } from '../../servicios-api/estudiante';

/*
 * Doble envío tras un error de red (plan de F1, sección i; ajuste C). Si el
 * POST /solicitudes falla sin respuesta, no se sabe si el servidor guardó.
 * El backend no tiene clave de idempotencia y F1 no agrega rutas, así que se
 * compara la lista de GET /consulta/solicitudes de antes del envío con la de
 * después: una solicitud nueva (código que no estaba) con el mismo tipo,
 * motivo y disponibilidad es la que se envió. El backend guarda el motivo y
 * la disponibilidad tal cual llegan (leerTexto solo recorta para validar).
 *
 * Límite conocido: dos solicitudes idénticas enviadas a la vez desde dos
 * pestañas se verían como una; no genera duplicados por sí mismo.
 */
export function buscarRegistrada(
  codigosPrevios: ReadonlySet<string>,
  lista: readonly Solicitud[],
  datos: DatosSolicitud,
): Solicitud | null {
  return (
    lista.find(
      (solicitud) =>
        !codigosPrevios.has(solicitud.codigo) &&
        solicitud.tipoApoyo === datos.tipoApoyo &&
        solicitud.motivo === datos.motivo &&
        solicitud.disponibilidad === datos.disponibilidad,
    ) ?? null
  );
}
