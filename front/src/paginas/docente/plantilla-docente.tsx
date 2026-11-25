import type { ReactNode } from 'react';
import {
  NavegacionRol,
  type EnlaceRol,
} from '../../componentes/navegacion-rol';
import type { TarjetaInicio } from '../../componentes/pagina-inicio';
import { Plantilla } from '../../componentes/plantilla';
import { TITULO_INICIO } from '../../componentes/textos';
import { DESCRIPCION_INICIO_DOCENTE, TITULOS_DOCENTE } from './textos';

/* Rutas del espacio del Docente (plan de F2, §1). */
export const RUTAS_DOCENTE = {
  inicio: '/docente/inicio',
  consultaCurso: '/docente',
  curso: (idCurso: string) => `/docente/cursos/${encodeURIComponent(idCurso)}`,
  alertasEmitidas: '/docente/alertas',
} as const;

export const ENLACES_DOCENTE: readonly EnlaceRol[] = [
  { ruta: RUTAS_DOCENTE.inicio, rotulo: TITULO_INICIO, icono: 'house' },
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
];

/** Tarjetas del inicio del Docente, por la ruta de su función (§7.0). */
export const TARJETAS_INICIO_DOCENTE: Readonly<Record<string, TarjetaInicio>> =
  {
    [RUTAS_DOCENTE.consultaCurso]: {
      descripcion: DESCRIPCION_INICIO_DOCENTE.consultaCurso,
    },
    [RUTAS_DOCENTE.alertasEmitidas]: {
      descripcion: DESCRIPCION_INICIO_DOCENTE.alertasEmitidas,
    },
  };

/* Plantilla de F0 con la navegación del Docente («Inicio» y dos funciones). */
export function PlantillaDocente({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  /** Ayuda bajo el título (§3.1; el listado del curso, §7.3). */
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <Plantilla
      titulo={titulo}
      ayuda={ayuda}
      navegacion={<NavegacionRol enlaces={ENLACES_DOCENTE} />}
    >
      {children}
    </Plantilla>
  );
}
