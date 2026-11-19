import { Link, useLocation } from 'react-router';
import estilos from './plantilla.module.css';

/*
 * Navegación dentro del espacio de un rol (F1, respuesta 2). El enlace de la
 * pantalla actual lleva aria-current="page" (accesibilidad base). Por
 * defecto un enlace solo está activo en su ruta exacta; `tambienEn` agrega
 * prefijos de subrutas que le pertenecen (F2: /docente/cursos/… es parte de
 * «Consulta de curso», pero /docente/alertas no).
 */

export interface EnlaceRol {
  ruta: string;
  rotulo: string;
  tambienEn?: readonly string[];
}

function estaActivo(enlace: EnlaceRol, ruta: string): boolean {
  return (
    ruta === enlace.ruta ||
    (enlace.tambienEn ?? []).some((prefijo) => ruta.startsWith(prefijo))
  );
}

export function NavegacionRol({ enlaces }: { enlaces: readonly EnlaceRol[] }) {
  const { pathname } = useLocation();
  return (
    <nav className={estilos['navegacion']}>
      <ul>
        {enlaces.map((enlace) => (
          <li key={enlace.ruta}>
            <Link
              to={enlace.ruta}
              aria-current={estaActivo(enlace, pathname) ? 'page' : undefined}
            >
              {enlace.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
