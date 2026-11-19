import { NOMBRE_ROL } from '../../componentes/roles';
import { Plantilla } from '../../componentes/plantilla';

/* Espacio del Estudiante (F0: vacío; las pantallas de negocio son de F1). */
export function EspacioEstudiante() {
  return <Plantilla titulo={NOMBRE_ROL.ESTUDIANTE} />;
}
