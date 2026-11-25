import type { ReactNode } from 'react';
import logoIcono from '../activos/logo-icono.png';
import { iniciales } from './formato';
import { Icono } from './icono';
import estilos from './plantilla.module.css';
import { NOMBRE_ROL } from './roles';
import { useSesion } from './sesion';
import { NOMBRE_SISTEMA, ROTULOS, TEXTO_LOGO } from './textos';
import { useTituloPestana } from './titulo-pestana';

/*
 * Plantilla común de los cuatro roles (F0; barra lateral en F5b-diseño,
 * especificación §3.1 y 3.2): marca, rol, menú del rol, usuario y «Cerrar
 * sesión». En escritorio es una barra lateral; en pantallas pequeñas, una
 * barra superior en el mismo orden del DOM, para que el orden del foco
 * coincida con el visual (WCAG 2.4.3).
 */
export function Plantilla({
  titulo,
  navegacion,
  volver,
  ayuda,
  tituloPestana,
  children,
}: {
  titulo: string;
  /** Texto de ayuda bajo el título (especificación, §3.1). */
  ayuda?: string;
  /** Título de la pestaña, si difiere del h1 (inicio, §7.0). */
  tituloPestana?: string;
  /** Navegación del rol (F1). */
  navegacion?: ReactNode;
  /** Enlace de regreso, encima del título (especificación, §7.4 y 7.5). */
  volver?: ReactNode;
  children?: ReactNode;
}) {
  useTituloPestana(tituloPestana ?? titulo);
  const { usuario } = useSesion();
  const rol = usuario ? NOMBRE_ROL[usuario.rol] : '';
  return (
    <div className={estilos['pagina']}>
      <header className={estilos['barra']}>
        <div className={estilos['marca']}>
          <img src={logoIcono} alt={TEXTO_LOGO} className={estilos['logo']} />
          <span className={estilos['sistema']}>{NOMBRE_SISTEMA}</span>
        </div>
        <p className={estilos['rotulo-rol']}>{rol}</p>
        {navegacion}
        <Cuenta rol={rol} />
      </header>
      <main className={estilos['contenido']}>
        {volver}
        <h1>{titulo}</h1>
        {ayuda !== undefined && <p className={estilos['ayuda']}>{ayuda}</p>}
        {children}
      </main>
    </div>
  );
}

/** Usuario de la sesión con sus iniciales y «Cerrar sesión» (§3.1). */
function Cuenta({ rol }: { rol: string }) {
  const { usuario, cerrar } = useSesion();
  const nombre = usuario?.nombre ?? '';
  return (
    <div className={estilos['cuenta']}>
      <div className={estilos['usuario']}>
        <span aria-hidden="true" className={estilos['avatar']}>
          {iniciales(nombre)}
        </span>
        <span className={estilos['datos']}>
          <span className={estilos['nombre']}>{nombre}</span>
          <span className={estilos['rol']}>{rol}</span>
        </span>
      </div>
      <button
        type="button"
        className={estilos['cerrar']}
        onClick={() => void cerrar()}
      >
        <Icono nombre="log-out" tamano={18} />
        {ROTULOS.cerrarSesion}
      </button>
    </div>
  );
}
