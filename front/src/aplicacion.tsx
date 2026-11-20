import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import {
  Inicio,
  RutaProtegida,
  SoloSinSesion,
} from './componentes/ruta-protegida';
import { ProveedorSesion } from './componentes/sesion';
import { PaginaActivar } from './paginas/acceso/activar';
import { PaginaIniciarSesion } from './paginas/acceso/iniciar-sesion';
import { PaginaSolicitarActivacion } from './paginas/acceso/solicitar-activacion';
import { AlertasEmitidas } from './paginas/docente/alertas-emitidas';
import { ConsultaCurso } from './paginas/docente/consulta-curso';
import { PaginaListadoCurso } from './paginas/docente/listado-curso';
import { ConsultaAcademica } from './paginas/estudiante/consulta-academica';
import { MisSolicitudes } from './paginas/estudiante/mis-solicitudes';
import { PaginaSolicitarAcompanamiento } from './paginas/estudiante/solicitar-acompanamiento';
import { BandejaCasos } from './paginas/jefe-departamento/bandeja-casos';
import { PaginaDetalleCaso } from './paginas/jefe-departamento/detalle-caso';
import { EspacioPsicologo } from './paginas/psicologo/espacio-psicologo';
import type { Rol } from './servicios-api/tipos';

/*
 * Rutas del front (plan de F0 aprobado; F1, F2, F3). /activar la fija el enlace
 * que envía el backend (`${URL_FRONTEND}/activar#token=…`). Va dentro de un
 * enrutador (BrowserRouter en main.tsx; MemoryRouter en las pruebas).
 */

/** Rutas de cada rol (tabla de correspondencias, convenciones de F1b). */
const RUTAS_PROTEGIDAS: readonly {
  ruta: string;
  rol: Rol;
  pantalla: ReactNode;
}[] = [
  { ruta: '/estudiante', rol: 'ESTUDIANTE', pantalla: <ConsultaAcademica /> },
  {
    ruta: '/estudiante/solicitudes',
    rol: 'ESTUDIANTE',
    pantalla: <MisSolicitudes />,
  },
  {
    ruta: '/estudiante/solicitudes/nueva',
    rol: 'ESTUDIANTE',
    pantalla: <PaginaSolicitarAcompanamiento />,
  },
  { ruta: '/docente', rol: 'DOCENTE', pantalla: <ConsultaCurso /> },
  {
    ruta: '/docente/cursos/:idCurso',
    rol: 'DOCENTE',
    pantalla: <PaginaListadoCurso />,
  },
  { ruta: '/docente/alertas', rol: 'DOCENTE', pantalla: <AlertasEmitidas /> },
  {
    ruta: '/jefe-departamento',
    rol: 'JEFE_DEPARTAMENTO',
    pantalla: <BandejaCasos />,
  },
  {
    ruta: '/jefe-departamento/casos/:idCaso',
    rol: 'JEFE_DEPARTAMENTO',
    pantalla: <PaginaDetalleCaso />,
  },
  { ruta: '/psicologo', rol: 'PSICOLOGO', pantalla: <EspacioPsicologo /> },
];

export function Aplicacion() {
  return (
    <ProveedorSesion>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route
          path="/iniciar-sesion"
          element={
            <SoloSinSesion>
              <PaginaIniciarSesion />
            </SoloSinSesion>
          }
        />
        <Route
          path="/solicitar-activacion"
          element={
            <SoloSinSesion>
              <PaginaSolicitarActivacion />
            </SoloSinSesion>
          }
        />
        <Route path="/activar" element={<PaginaActivar />} />
        {RUTAS_PROTEGIDAS.map(({ ruta, rol, pantalla }) => (
          <Route
            key={ruta}
            path={ruta}
            element={<RutaProtegida rol={rol}>{pantalla}</RutaProtegida>}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProveedorSesion>
  );
}
