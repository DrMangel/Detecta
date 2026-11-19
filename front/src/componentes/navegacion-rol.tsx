import { NavLink } from 'react-router';
import estilos from './plantilla.module.css';

/*
 * Navegación dentro del espacio de un rol (F1, respuesta 2). NavLink marca la
 * pantalla actual con aria-current="page" (accesibilidad base). `end` evita
 * que la ruta raíz del rol quede marcada en sus subrutas.
 */

export interface EnlaceRol {
  ruta: string;
  rotulo: string;
}

export function NavegacionRol({ enlaces }: { enlaces: readonly EnlaceRol[] }) {
  return (
    <nav className={estilos['navegacion']}>
      <ul>
        {enlaces.map((enlace) => (
          <li key={enlace.ruta}>
            <NavLink to={enlace.ruta} end>
              {enlace.rotulo}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
