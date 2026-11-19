import { NOMBRE_ROL } from '../../componentes/roles';
import { Plantilla } from '../../componentes/plantilla';

/*
 * Espacio del Jefe de Departamento de Programa (F0: vacío; las pantallas de
 * negocio son de F3).
 */
export function EspacioJefeDepartamento() {
  return <Plantilla titulo={NOMBRE_ROL.JEFE_DEPARTAMENTO} />;
}
