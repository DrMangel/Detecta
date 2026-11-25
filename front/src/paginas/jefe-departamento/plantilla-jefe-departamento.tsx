import type { ReactNode } from 'react';
import {
  NavegacionRol,
  type EnlaceRol,
} from '../../componentes/navegacion-rol';
import type { TarjetaInicio } from '../../componentes/pagina-inicio';
import { Plantilla } from '../../componentes/plantilla';
import { TEXTO_INICIO_INFORMES, TITULO_INICIO } from '../../componentes/textos';
import { DESCRIPCION_INICIO_JEFE, TITULOS_JEFE } from './textos';

/* Rutas del espacio del Jefe de Departamento (plan de F3, §1). */
export const RUTAS_JEFE = {
  inicio: '/jefe-departamento/inicio',
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
export function enlacesJefe(origen: TipoBandeja): readonly EnlaceRol[] {
  const detalleEn = (bandeja: TipoBandeja) =>
    bandeja === origen ? PREFIJO_DETALLE : [];
  return [
    { ruta: RUTAS_JEFE.inicio, rotulo: TITULO_INICIO, icono: 'house' },
    {
      ruta: RUTA_BANDEJA.pendientes,
      rotulo: TITULOS_JEFE.casosPendientes,
      icono: 'file-text',
      tambienEn: detalleEn('pendientes'),
    },
    {
      ruta: RUTA_BANDEJA.rutaAcademica,
      rotulo: TITULOS_JEFE.rutaAcademica,
      icono: 'graduation-cap',
      tambienEn: detalleEn('rutaAcademica'),
    },
    {
      ruta: RUTAS_JEFE.informes,
      rotulo: TITULOS_JEFE.informes,
      icono: 'chart-line',
    },
  ];
}

/** Tarjetas del inicio del Jefe, por la ruta de su función (§7.0). */
export const TARJETAS_INICIO_JEFE: Readonly<Record<string, TarjetaInicio>> = {
  [RUTA_BANDEJA.pendientes]: {
    descripcion: DESCRIPCION_INICIO_JEFE.casosPendientes,
  },
  [RUTA_BANDEJA.rutaAcademica]: {
    descripcion: DESCRIPCION_INICIO_JEFE.rutaAcademica,
  },
  [RUTAS_JEFE.informes]: { descripcion: TEXTO_INICIO_INFORMES },
};

/* Plantilla de F0 con la navegación del Jefe («Inicio» y tres funciones). */
export function PlantillaJefe({
  titulo,
  origen = 'pendientes',
  volver,
  children,
}: {
  titulo: string;
  origen?: TipoBandeja;
  /** Enlace de regreso, encima del título. */
  volver?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Plantilla
      titulo={titulo}
      navegacion={<NavegacionRol enlaces={enlacesJefe(origen)} />}
      volver={volver}
    >
      {children}
    </Plantilla>
  );
}
