import type { ReactNode } from 'react';
import { NavegacionRol } from '../../componentes/navegacion-rol';
import { Plantilla } from '../../componentes/plantilla';
import { TITULOS_PSICOLOGO } from './textos';

export const RUTAS_PSICOLOGO = {
  remisiones: '/psicologo',
  caso: (idCaso: string) => `/psicologo/casos/${encodeURIComponent(idCaso)}`,
  informes: '/psicologo/informes',
} as const;

const ENLACES_PSICOLOGO = [
  {
    ruta: RUTAS_PSICOLOGO.remisiones,
    rotulo: TITULOS_PSICOLOGO.remisiones,
    tambienEn: ['/psicologo/casos/'],
  },
  {
    ruta: RUTAS_PSICOLOGO.informes,
    rotulo: TITULOS_PSICOLOGO.informes,
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
    <Plantilla
      titulo={titulo}
      navegacion={<NavegacionRol enlaces={ENLACES_PSICOLOGO} />}
    >
      {children}
    </Plantilla>
  );
}
