import type { CasoRiesgo } from '../../dominio/entidades/caso-riesgo';

/**
 * Coherencia estudiante–caso–origen (ajuste B de Ivan en el plan de B2): el
 * estudiante del caso debe ser el de su origen (alerta: el del registro;
 * solicitud: el que la radica). La BD no puede expresarlo con un CHECK porque
 * cruza tablas; lo verifica el mapeador al leer y al escribir.
 */
export function verificarCoherenciaEstudianteOrigen(caso: CasoRiesgo): void {
  const delCaso = caso.obtenerEstudiante().id;
  const delOrigen = caso.origen.obtenerEstudiante().id;
  if (delCaso !== delOrigen) {
    throw new Error(
      `Incoherencia en el caso ${caso.idCaso}: su estudiante (${delCaso}) no es el de su origen (${delOrigen})`,
    );
  }
}
