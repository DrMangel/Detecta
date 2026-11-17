import { readFileSync } from 'node:fs';

/**
 * Configuración del `ConectorBDConfigurable` (ER 3.6.3 y 3.7 e; Manual
 * 4.1.1.8): el origen (tabla o vista) y el mapeo de campos que relaciona
 * cada campo de la Tabla 2 del ER con la columna de la institución. No
 * contiene secretos: las credenciales vienen de variables de entorno.
 * Se lee de un JSON cuya ruta indica CONECTOR_CONFIGURACION (respuesta 9).
 */

/** Campos requeridos de entrada de la Tabla 2 del ER. */
export const CAMPOS_TABLA_2 = [
  'id_estudiante',
  'nombre_estudiante',
  'correo_estudiante',
  'fecha_nacimiento',
  'programa_academico',
  'codigo_asignatura',
  'calificacion_acumulada',
  'porcentaje_asistencia',
] as const;

export type CampoTabla2 = (typeof CAMPOS_TABLA_2)[number];

export interface ConfiguracionConector {
  /** Tabla o vista de origen, con esquema opcional: `vista` o `esquema.vista`. */
  origen: string;
  /** Campo de la Tabla 2 → columna en el origen de la institución. */
  mapeoCampos: Record<CampoTabla2, string>;
}

/**
 * Identificador SQL simple. Se valida antes de usarlo en una consulta, porque
 * los nombres de columna no pueden ir como parámetros: así nunca llega texto
 * arbitrario al SQL (OWASP, inyección).
 */
const IDENTIFICADOR = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

export function validarConfiguracionConector(
  json: unknown,
): ConfiguracionConector {
  const errores: string[] = [];
  const raiz = (
    typeof json === 'object' && json !== null ? json : {}
  ) as Record<string, unknown>;

  const origen = raiz['origen'];
  if (
    typeof origen !== 'string' ||
    !origen.split('.').every((parte) => IDENTIFICADOR.test(parte)) ||
    origen.split('.').length > 2
  ) {
    errores.push('"origen" debe ser un identificador: vista o esquema.vista');
  }

  const mapeo = (
    typeof raiz['mapeoCampos'] === 'object' && raiz['mapeoCampos'] !== null
      ? raiz['mapeoCampos']
      : {}
  ) as Record<string, unknown>;
  for (const campo of CAMPOS_TABLA_2) {
    const columna = mapeo[campo];
    if (typeof columna !== 'string' || !IDENTIFICADOR.test(columna)) {
      errores.push(`mapeoCampos.${campo} debe ser un nombre de columna válido`);
    }
  }
  for (const clave of Object.keys(mapeo)) {
    if (!(CAMPOS_TABLA_2 as readonly string[]).includes(clave)) {
      errores.push(`mapeoCampos.${clave} no es un campo de la Tabla 2 del ER`);
    }
  }

  if (errores.length > 0) {
    throw new Error(
      `Configuración del conector inválida:\n- ${errores.join('\n- ')}`,
    );
  }
  return {
    origen: origen as string,
    mapeoCampos: mapeo as Record<CampoTabla2, string>,
  };
}

export function cargarConfiguracionConector(
  ruta: string,
): ConfiguracionConector {
  return validarConfiguracionConector(JSON.parse(readFileSync(ruta, 'utf8')));
}

/** Cita un identificador ya validado (`a.b` → `"a"."b"`). */
export function citarIdentificador(identificador: string): string {
  return identificador
    .split('.')
    .map((parte) => `"${parte}"`)
    .join('.');
}
