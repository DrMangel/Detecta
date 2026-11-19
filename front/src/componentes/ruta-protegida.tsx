import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { Rol } from '../servicios-api/tipos';
import { ESPACIO_POR_ROL } from './roles';
import { useSesion } from './sesion';

/*
 * Ruta por rol (F0). Solo ayuda de usabilidad: la autorización real está en
 * el backend (Manual 4.1.1.1). Sin sesión lleva al inicio de sesión; con la
 * sesión de otro rol, al espacio propio. Mientras se consulta la sesión
 * inicial no redirige (evita bucles, ajuste A).
 */
export function RutaProtegida({
  rol,
  children,
}: {
  rol: Rol;
  children: ReactNode;
}) {
  const { usuario } = useSesion();
  if (usuario === undefined) {
    return <div aria-busy="true" />;
  }
  if (usuario === null) {
    return <Navigate to="/iniciar-sesion" replace />;
  }
  if (usuario.rol !== rol) {
    return <Navigate to={ESPACIO_POR_ROL[usuario.rol]} replace />;
  }
  return children;
}

/** Pantallas de acceso: con sesión vigente, al espacio del rol. */
export function SoloSinSesion({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  if (usuario === undefined) {
    return <div aria-busy="true" />;
  }
  if (usuario !== null) {
    return <Navigate to={ESPACIO_POR_ROL[usuario.rol]} replace />;
  }
  return children;
}

/** Raíz: al espacio del rol o al inicio de sesión. */
export function Inicio() {
  const { usuario } = useSesion();
  if (usuario === undefined) {
    return <div aria-busy="true" />;
  }
  return (
    <Navigate
      to={usuario === null ? '/iniciar-sesion' : ESPACIO_POR_ROL[usuario.rol]}
      replace
    />
  );
}
