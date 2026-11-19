import type { ReactNode } from 'react';
import estilos from './plantilla.module.css';
import { useSesion } from './sesion';
import { NOMBRE_SISTEMA, ROTULOS } from './textos';
import { useTituloPestana } from './titulo-pestana';

/*
 * Plantilla del espacio de un rol (F0): encabezado con el nombre del
 * sistema, el usuario de la sesión y «Cerrar sesión»; título de la pantalla.
 */
export function Plantilla({
  titulo,
  children,
}: {
  titulo: string;
  children?: ReactNode;
}) {
  const { usuario, cerrar } = useSesion();
  useTituloPestana(titulo);
  return (
    <div className={estilos['pagina']}>
      <header className={estilos['encabezado']}>
        <span className={estilos['sistema']}>{NOMBRE_SISTEMA}</span>
        <span className={estilos['usuario']}>{usuario?.nombre}</span>
        <button
          type="button"
          className={estilos['cerrar']}
          onClick={() => void cerrar()}
        >
          {ROTULOS.cerrarSesion}
        </button>
      </header>
      <main className={estilos['contenido']}>
        <h1>{titulo}</h1>
        {children}
      </main>
    </div>
  );
}
