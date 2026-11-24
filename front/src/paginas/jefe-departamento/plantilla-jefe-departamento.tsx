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

const ENLACES = [
  {
    ruta: RUTAS_JEFE.casosPendientes,
    rotulo: TITULOS_JEFE.casosPendientes,
    // El detalle de un caso es parte de la bandeja, también cuando se abre
    // desde «En ruta académica» (limitación aceptada en F5b).
    tambienEn: ['/jefe-departamento/casos/'],
  },
  { ruta: RUTAS_JEFE.rutaAcademica, rotulo: TITULOS_JEFE.rutaAcademica },
  { ruta: RUTAS_JEFE.informes, rotulo: TITULOS_JEFE.informes },
] as const;

/* Plantilla de F0 con la navegación de tres enlaces del Jefe. */
export function PlantillaJefe({
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
