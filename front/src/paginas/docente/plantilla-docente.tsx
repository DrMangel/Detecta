import type { ReactNode } from 'react';
import { NavegacionRol } from '../../componentes/navegacion-rol';
import { Plantilla } from '../../componentes/plantilla';
import { TITULOS_DOCENTE } from './textos';

/* Rutas del espacio del Docente (plan de F2, §1). */
export const RUTAS_DOCENTE = {
  consultaCurso: '/docente',
  curso: (idCurso: string) => `/docente/cursos/${encodeURIComponent(idCurso)}`,
  alertasEmitidas: '/docente/alertas',
} as const;

const ENLACES = [
  {
    ruta: RUTAS_DOCENTE.consultaCurso,
    rotulo: TITULOS_DOCENTE.consultaCurso,
    icono: 'book-open',
    // El listado de un curso es parte de la consulta de curso.
    tambienEn: ['/docente/cursos/'],
  },
  {
    ruta: RUTAS_DOCENTE.alertasEmitidas,
    rotulo: TITULOS_DOCENTE.alertasEmitidas,
    icono: 'bell',
  },
] as const;

/* Plantilla de F0 con la navegación de dos enlaces del Docente. */
export function PlantillaDocente({
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
