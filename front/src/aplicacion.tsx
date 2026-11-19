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
import { EspacioDocente } from './paginas/docente/espacio-docente';
import { EspacioEstudiante } from './paginas/estudiante/espacio-estudiante';
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
        <Route
          path="/estudiante"
          element={
            <RutaProtegida rol="ESTUDIANTE">
              <EspacioEstudiante />
            </RutaProtegida>
          }
        />
        <Route
          path="/docente"
          element={
            <RutaProtegida rol="DOCENTE">
              <EspacioDocente />
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
