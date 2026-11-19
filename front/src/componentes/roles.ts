import type { Rol } from '../servicios-api/tipos';

/*
 * Espacio de cada rol (diagrama de paquetes, Manual 4.1.2: paginas/<rol>;
 * respuesta 1 del plan de F0: jefe-departamento). Ocultar o redirigir por rol
 * es solo una ayuda de usabilidad: la autorización real está en el backend
 * (Manual 4.1.1.1).
 */

export const ESPACIO_POR_ROL: Readonly<Record<Rol, string>> = {
  ESTUDIANTE: '/estudiante',
  DOCENTE: '/docente',
  JEFE_DEPARTAMENTO: '/jefe-departamento',
  PSICOLOGO: '/psicologo',
};

/** Título del espacio de cada rol (texto aprobado en el plan de F0). */
export const NOMBRE_ROL: Readonly<Record<Rol, string>> = {
  ESTUDIANTE: 'Estudiante',
  DOCENTE: 'Docente',
  JEFE_DEPARTAMENTO: 'Jefe de Departamento de Programa',
  PSICOLOGO: 'Psicólogo',
};
