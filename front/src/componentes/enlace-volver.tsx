import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icono } from './icono';
import estilos from './volver.module.css';

/*
 * Enlace de regreso encima del título (especificación de diseño, §7.4 y
 * 7.5): solo navega. Unifica los .volver del Jefe y del Psicólogo (D3).
 */
export function EnlaceVolver({
  a,
  children,
}: {
  a: string;
  children: ReactNode;
}) {
  return (
    <Link to={a} className={estilos['volver']}>
      <Icono nombre="arrow-left" />
      {children}
    </Link>
  );
}
