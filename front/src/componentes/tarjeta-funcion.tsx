import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icono, type NombreIcono } from './icono';
import estilos from './tarjeta-funcion.module.css';

/*
 * Tarjeta de función de la pantalla de inicio (especificación de diseño,
 * §7.0): toda la tarjeta es un enlace a una pantalla existente, con ícono,
 * nombre, descripción, una insignia opcional y chevron-right.
 */
export function TarjetaFuncion({
  ruta,
  titulo,
  descripcion,
  icono,
  insignia,
  destacada = false,
}: {
  ruta: string;
  titulo: string;
  descripcion: string;
  icono: NombreIcono;
  insignia?: ReactNode;
  /** Borde de 2 px (§7.0: «Solicitar acompañamiento» del Estudiante). */
  destacada?: boolean;
}) {
  const clase = destacada
    ? `${estilos['tarjeta']} ${estilos['destacada']}`
    : estilos['tarjeta'];
  return (
    <Link to={ruta} className={clase}>
      <span className={estilos['icono']}>
        <Icono nombre={icono} tamano={24} />
      </span>
      <span className={estilos['texto']}>
        <span className={estilos['titulo']}>{titulo}</span>
        <span className={estilos['descripcion']}>{descripcion}</span>
        {insignia}
      </span>
      <span className={estilos['flecha']}>
        <Icono nombre="chevron-right" />
      </span>
    </Link>
  );
}
