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
    icono: 'users',
    tambienEn: ['/psicologo/casos/'],
  },
  {
    ruta: RUTAS_PSICOLOGO.informes,
    rotulo: TITULOS_PSICOLOGO.informes,
    icono: 'chart-line',
  },
] as const;

export function PlantillaPsicologo({
  titulo,
  volver,
  children,
}: {
  titulo: string;
  /** Enlace de regreso, encima del título. */
  volver?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Plantilla
      titulo={titulo}
      navegacion={<NavegacionRol enlaces={ENLACES_PSICOLOGO} />}
      volver={volver}
    >
      {children}
    </Plantilla>
  );
}
