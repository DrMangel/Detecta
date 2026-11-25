import type { ReactNode } from 'react';
import { Icono, type NombreIcono } from './icono';
import estilos from './aviso.module.css';

/*
 * Aviso estático con ícono (especificación de diseño §4; F5b-diseño, D7a):
 * la confidencialidad de la solicitud del Estudiante (§7.2) y el
 * consentimiento pendiente del Psicólogo (§7.5). No es un mensaje en vivo:
 * la pantalla que necesite anunciar un cambio pone su propia región
 * aria-live alrededor (como la solicitud del Estudiante).
 */
export function Aviso({
  icono,
  children,
}: {
  icono: NombreIcono;
  children: ReactNode;
}) {
  return (
    <div className={estilos['aviso']}>
      <Icono nombre={icono} />
      <div className={estilos['texto']}>{children}</div>
    </div>
  );
}
