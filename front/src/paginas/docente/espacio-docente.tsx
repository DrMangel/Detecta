import { NOMBRE_ROL } from '../../componentes/roles';
import { Plantilla } from '../../componentes/plantilla';

/* Espacio del Docente (F0: vacío; las pantallas de negocio son de F2). */
export function EspacioDocente() {
  return <Plantilla titulo={NOMBRE_ROL.DOCENTE} />;
}
