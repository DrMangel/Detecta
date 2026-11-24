import type { ReactNode } from 'react';
import { NavegacionRol } from '../../componentes/navegacion-rol';
import { Plantilla } from '../../componentes/plantilla';
import { TITULOS_ESTUDIANTE } from './textos';

/* Rutas del espacio del Estudiante (F1, respuesta 2). */
export const RUTAS_ESTUDIANTE = {
  consulta: '/estudiante',
  solicitudes: '/estudiante/solicitudes',
  nuevaSolicitud: '/estudiante/solicitudes/nueva',
} as const;

const ENLACES = [
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
] as const;

/* Plantilla de F0 con la navegación de tres enlaces del Estudiante. */
export function PlantillaEstudiante({
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
