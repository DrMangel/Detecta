/*
 * Tipos del contrato de la API (ControladorAcceso, B3; línea base §5). Los
 * valores del rol son los del enumerado `Rol` del diagrama de clases v3.
 */

export type Rol = 'ESTUDIANTE' | 'DOCENTE' | 'JEFE_DEPARTAMENTO' | 'PSICOLOGO';

/** Respuesta de POST /acceso/iniciar-sesion y GET /acceso/sesion. */
export interface DatosSesion {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
}
