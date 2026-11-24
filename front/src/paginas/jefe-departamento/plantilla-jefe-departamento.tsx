import type { ReactNode } from 'react';
import { NavegacionRol } from '../../componentes/navegacion-rol';
import { Plantilla } from '../../componentes/plantilla';
import { TITULOS_JEFE } from './textos';

/* Rutas del espacio del Jefe de Departamento (plan de F3, §1). */
export const RUTAS_JEFE = {
  casosPendientes: '/jefe-departamento',
  rutaAcademica: '/jefe-departamento/ruta-academica',
  caso: (idCaso: string) =>
    `/jefe-departamento/casos/${encodeURIComponent(idCaso)}`,
  informes: '/jefe-departamento/informes',
} as const;

/** Bandejas de casos del Jefe y su ruta (F5b, D38). */
export const RUTA_BANDEJA = {
  pendientes: RUTAS_JEFE.casosPendientes,
  rutaAcademica: RUTAS_JEFE.rutaAcademica,
} as const;

export type TipoBandeja = keyof typeof RUTA_BANDEJA;

export function esTipoBandeja(valor: unknown): valor is TipoBandeja {
  return typeof valor === 'string' && Object.hasOwn(RUTA_BANDEJA, valor);
}

const PREFIJO_DETALLE = ['/jefe-departamento/casos/'] as const;

/*
 * El detalle de un caso pertenece a la bandeja de la que se abrió: esa
 * entrada del menú lleva el prefijo del detalle y queda resaltada (F5b;
 * Manual 3.1.2.2.6, Tabla 30, «Dar el control al usuario»).
 */
function enlacesJefe(origen: TipoBandeja) {
  const detalleEn = (bandeja: TipoBandeja) =>
    bandeja === origen ? PREFIJO_DETALLE : [];
  return [
    {
      ruta: RUTA_BANDEJA.pendientes,
      rotulo: TITULOS_JEFE.casosPendientes,
      tambienEn: detalleEn('pendientes'),
    },
    {
      ruta: RUTA_BANDEJA.rutaAcademica,
      rotulo: TITULOS_JEFE.rutaAcademica,
      tambienEn: detalleEn('rutaAcademica'),
    },
    { ruta: RUTAS_JEFE.informes, rotulo: TITULOS_JEFE.informes },
  ];
}

/* Plantilla de F0 con la navegación de tres enlaces del Jefe. */
export function PlantillaJefe({
  titulo,
  origen = 'pendientes',
  children,
}: {
  titulo: string;
  origen?: TipoBandeja;
  children: ReactNode;
}) {
  return (
    <Plantilla
      titulo={titulo}
      navegacion={<NavegacionRol enlaces={enlacesJefe(origen)} />}
    >
      {children}
    </Plantilla>
  );
}
