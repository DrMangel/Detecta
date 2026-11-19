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
import { EspacioJefeDepartamento } from './paginas/jefe-departamento/espacio-jefe-departamento';
import { EspacioPsicologo } from './paginas/psicologo/espacio-psicologo';

/*
 * Rutas del front (plan de F0 aprobado). /activar la fija el enlace que envía
 * el backend (`${URL_FRONTEND}/activar#token=…`). Va dentro de un enrutador
 * (BrowserRouter en main.tsx; MemoryRouter en las pruebas).
 */
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
        {/* Espacio del Estudiante (F1, respuesta 2). */}
        <Route
          path="/estudiante"
          element={
            <RutaProtegida rol="ESTUDIANTE">
              <ConsultaAcademica />
            </RutaProtegida>
          }
        />
        <Route
          path="/estudiante/solicitudes"
          element={
            <RutaProtegida rol="ESTUDIANTE">
              <MisSolicitudes />
            </RutaProtegida>
          }
        />
        <Route
          path="/estudiante/solicitudes/nueva"
          element={
            <RutaProtegida rol="ESTUDIANTE">
              <PaginaSolicitarAcompanamiento />
            </RutaProtegida>
          }
        />
        {/* Espacio del Docente (plan de F2, §1). */}
        <Route
          path="/docente"
          element={
            <RutaProtegida rol="DOCENTE">
              <ConsultaCurso />
            </RutaProtegida>
          }
        />
        <Route
          path="/docente/cursos/:idCurso"
          element={
            <RutaProtegida rol="DOCENTE">
              <PaginaListadoCurso />
            </RutaProtegida>
          }
        />
        <Route
          path="/docente/alertas"
          element={
            <RutaProtegida rol="DOCENTE">
              <AlertasEmitidas />
            </RutaProtegida>
          }
        />
        <Route
          path="/jefe-departamento"
          element={
            <RutaProtegida rol="JEFE_DEPARTAMENTO">
              <EspacioJefeDepartamento />
            </RutaProtegida>
          }
        />
        <Route
          path="/psicologo"
          element={
            <RutaProtegida rol="PSICOLOGO">
              <EspacioPsicologo />
            </RutaProtegida>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProveedorSesion>
  );
}
