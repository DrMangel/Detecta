/*
 * Textos de pantalla nuevos de F0 (provisionales, aprobados por Ivan en el
 * plan de F0). No vienen del ER ni de los diagramas. Los textos de error
 * nuevos están en servicios-api/errores.ts; los del backend se muestran tal
 * cual llegan.
 */

export const ROTULOS = {
  correo: 'Correo electrónico',
  contrasena: 'Contraseña',
  nuevaContrasena: 'Nueva contraseña',
  iniciarSesion: 'Iniciar sesión',
  cerrarSesion: 'Cerrar sesión',
  solicitarEnlace: 'Solicitar enlace',
  fijarContrasena: 'Fijar contraseña',
} as const;

export const TITULOS = {
  iniciarSesion: 'Iniciar sesión',
  solicitarEnlace: 'Solicitar enlace de acceso',
  fijarContrasena: 'Fijar contraseña',
} as const;

/** Confirmación tras fijar la contraseña (aprobada en el cierre de F0). */
export const TEXTO_CONTRASENA_FIJADA =
  'Contraseña fijada. Ya puede iniciar sesión.';

/** Nombre del sistema (ER), en la pestaña y en el encabezado. */
export const NOMBRE_SISTEMA = 'DETECTA';
