import type { ReactNode } from 'react';
import {
  NavegacionRol,
  type EnlaceRol,
} from '../../componentes/navegacion-rol';
import type { TarjetaInicio } from '../../componentes/pagina-inicio';
import { Plantilla } from '../../componentes/plantilla';
import { TITULO_INICIO } from '../../componentes/textos';
import { DESCRIPCION_INICIO_ESTUDIANTE, TITULOS_ESTUDIANTE } from './textos';

/* Rutas del espacio del Estudiante (F1, respuesta 2). */
export const RUTAS_ESTUDIANTE = {
  inicio: '/estudiante/inicio',
  consulta: '/estudiante',
  solicitudes: '/estudiante/solicitudes',
  nuevaSolicitud: '/estudiante/solicitudes/nueva',
} as const;

export const ENLACES_ESTUDIANTE: readonly EnlaceRol[] = [
  { ruta: RUTAS_ESTUDIANTE.inicio, rotulo: TITULO_INICIO, icono: 'house' },
  {
    ruta: RUTAS_ESTUDIANTE.consulta,
    rotulo: TITULOS_ESTUDIANTE.consulta,
    icono: 'book-open',
  },
  {
    ruta: RUTAS_ESTUDIANTE.solicitudes,
    rotulo: TITULOS_ESTUDIANTE.solicitudes,
    icono: 'list',
  },
  {
    ruta: RUTAS_ESTUDIANTE.nuevaSolicitud,
    rotulo: TITULOS_ESTUDIANTE.nuevaSolicitud,
    icono: 'target',
  },
];

/** Tarjetas del inicio del Estudiante, por la ruta de su función (§7.0). */
export const TARJETAS_INICIO_ESTUDIANTE: Readonly<
  Record<string, TarjetaInicio>
> = {
  [RUTAS_ESTUDIANTE.consulta]: {
    descripcion: DESCRIPCION_INICIO_ESTUDIANTE.consulta,
  },
  [RUTAS_ESTUDIANTE.solicitudes]: {
    descripcion: DESCRIPCION_INICIO_ESTUDIANTE.solicitudes,
  },
  [RUTAS_ESTUDIANTE.nuevaSolicitud]: {
    descripcion: DESCRIPCION_INICIO_ESTUDIANTE.nuevaSolicitud,
    confidencial: true,
  },
};

/* Plantilla de F0 con la navegación del Estudiante («Inicio» y tres funciones). */
export function PlantillaEstudiante({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <Plantilla
      titulo={titulo}
      navegacion={<NavegacionRol enlaces={ENLACES_ESTUDIANTE} />}
    >
      {children}
    </Plantilla>
  );
}
