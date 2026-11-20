import type { ReactNode } from 'react';
import { NavegacionRol } from '../../componentes/navegacion-rol';
import { Plantilla } from '../../componentes/plantilla';
import { TITULOS_PSICOLOGO } from './textos';

export const RUTAS_PSICOLOGO = {
  remisiones: '/psicologo',
  caso: (idCaso: string) => `/psicologo/casos/${encodeURIComponent(idCaso)}`,
} as const;

const ENLACES = [
  {
    ruta: RUTAS_PSICOLOGO.remisiones,
    rotulo: TITULOS_PSICOLOGO.remisiones,
    tambienEn: ['/psicologo/casos/'],
  },
] as const;

export function PlantillaPsicologo({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <Plantilla titulo={titulo} navegacion={<NavegacionRol enlaces={ENLACES} />}>
      {children}
    </Plantilla>
  );
}
