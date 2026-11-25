import type { ReactNode } from 'react';
import {
  NavegacionRol,
  type EnlaceRol,
} from '../../componentes/navegacion-rol';
import type { TarjetaInicio } from '../../componentes/pagina-inicio';
import { Plantilla } from '../../componentes/plantilla';
import { TEXTO_INICIO_INFORMES, TITULO_INICIO } from '../../componentes/textos';
import { DESCRIPCION_INICIO_PSICOLOGO, TITULOS_PSICOLOGO } from './textos';

export const RUTAS_PSICOLOGO = {
  inicio: '/psicologo/inicio',
  remisiones: '/psicologo',
  caso: (idCaso: string) => `/psicologo/casos/${encodeURIComponent(idCaso)}`,
  informes: '/psicologo/informes',
} as const;

export const ENLACES_PSICOLOGO: readonly EnlaceRol[] = [
  { ruta: RUTAS_PSICOLOGO.inicio, rotulo: TITULO_INICIO, icono: 'house' },
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
];

/** Tarjetas del inicio del Psicólogo, por la ruta de su función (§7.0). */
export const TARJETAS_INICIO_PSICOLOGO: Readonly<
  Record<string, TarjetaInicio>
> = {
  [RUTAS_PSICOLOGO.remisiones]: {
    descripcion: DESCRIPCION_INICIO_PSICOLOGO.remisiones,
  },
  [RUTAS_PSICOLOGO.informes]: { descripcion: TEXTO_INICIO_INFORMES },
};

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
