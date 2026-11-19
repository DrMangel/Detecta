import type { AlertaEmitida } from '../../servicios-api/docente';
import type { NivelRiesgo } from '../../servicios-api/estudiante';

/*
 * Doble envío de una alerta tras un error de red (plan de F2, §5; mismo
 * criterio que la solicitud en F1). POST /alertas no tiene clave de
 * idempotencia: se compara GET /alertas/emitidas del periodo del curso antes
 * y después del envío. Una alerta nueva (idAlerta que no estaba) del mismo
 * curso y estudiante, con el mismo nivel y la misma descripción, es la que
 * se envió. El backend guarda la descripción tal cual llega.
 *
 * El id del estudiante solo se usa aquí, en memoria (ajuste C).
 */
export interface AlertaEnviada {
  idCurso: string;
  idEstudiante: string;
  nivelRiesgo: NivelRiesgo;
  descripcion: string;
}

export function buscarAlertaRegistrada(
  previas: ReadonlySet<string>,
  lista: readonly AlertaEmitida[],
  enviada: AlertaEnviada,
): AlertaEmitida | null {
  return (
    lista.find(
      (alerta) =>
        !previas.has(alerta.idAlerta) &&
        alerta.curso.idCurso === enviada.idCurso &&
        alerta.estudiante.id === enviada.idEstudiante &&
        alerta.nivelRiesgo === enviada.nivelRiesgo &&
        alerta.descripcion === enviada.descripcion,
    ) ?? null
  );
}
