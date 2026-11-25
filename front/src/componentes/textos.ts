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

/**
 * Mismo texto que el 401 del backend, para el aviso que llega de otra
 * pestaña, donde no hay respuesta del backend que mostrar (decisión (g),
 * revisada).
 */
export const SESION_CADUCADA = 'Sesión no válida o caducada';

/** Nombre del sistema (ER), en la pestaña y en el encabezado. */
export const NOMBRE_SISTEMA = 'DETECTA';

/** Texto alternativo del logo (especificación de diseño, §3.3). */
export const TEXTO_LOGO = 'Logo de DETECTA';

/**
 * Estado de un paso de la línea de estado, solo para lectores de pantalla
 * (F5b-diseño, D3; provisional). El paso actual se anuncia con
 * aria-current="step".
 */
export const TEXTO_ESTADO_PASO = {
  hecho: 'completado',
  pendiente: 'pendiente',
} as const;

/* ---------- Nuevos de F5b-diseño (provisionales, especificación §8) ---------- */

/** Ayuda bajo «Iniciar sesión» (§7.1). */
export const TEXTO_AYUDA_INICIAR_SESION =
  'Ingresa con tu correo institucional.';

/** Pantalla de inicio de cada rol (§7.0): menú, pestaña, saludo y ayuda. */
export const TITULO_INICIO = 'Inicio';
export const TEXTO_AYUDA_INICIO =
  'Estas son las funciones disponibles para tu rol y para qué sirve cada una.';
export const TEXTO_CONFIDENCIAL = 'Confidencial';

/** «Hola, Ana»; sin nombre, «Hola». */
export function saludo(primerNombre: string): string {
  return primerNombre === '' ? 'Hola' : `Hola, ${primerNombre}`;
}

/** Tarjeta «Informes de riesgo» del inicio del Jefe y del Psicólogo (§8). */
export const TEXTO_INICIO_INFORMES =
  'Genera informes con totales por asignatura y periodo, sin datos personales.';

/** Informes de riesgo, ayuda bajo el título (§8; F5b-diseño, D7b). */
export const AYUDA_INFORMES =
  'Totales por asignatura y periodo, sin datos personales.';

/**
 * Aviso con lock del informe generado (§7.7; provisional, respuesta 7 del
 * plan de F5b-diseño): Informe solo trae ids, curso, totales, definiciones
 * y el resumen de consolidar() (generador-informe-riesgo.ts; ER 3.5.3, D18).
 */
export const AVISO_INFORME_AGREGADO =
  'Este informe solo contiene datos agregados: no incluye nombres, motivos ni contenido de los expedientes.';
