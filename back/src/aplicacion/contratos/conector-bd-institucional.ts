import type { Estudiante } from '../../dominio/entidades/estudiante';
import type { RegistroAcademico } from '../../dominio/entidades/registro-academico';

/**
 * Contrato `ConectorBDInstitucional` (diagrama de clases v3; diagrama de
 * paquetes: `aplicacion/contratos`). Firmas del diagrama, asíncronas aquí:
 *   conectar(): Boolean
 *   obtenerEstudiantes(idCurso: String): List<Estudiante>
 *   obtenerRegistros(idCurso: String): List<RegistroAcademico>
 *
 * Fuera del diagrama (aprobado en el plan de B4, respuesta 15):
 * `omisionesUltimaLectura()`, porque las firmas solo devuelven listas y el
 * servicio necesita saber cuántas filas se omitieron y por qué.
 */
export interface ConectorBDInstitucional {
  /**
   * Verifica la conexión y la estructura del origen. Devuelve true o lanza
   * `ErrorConectorInstitucional` con el mensaje de la Tabla 2 del ER.
   */
  conectar(): Promise<boolean>;
  obtenerEstudiantes(idCurso: string): Promise<Estudiante[]>;
  obtenerRegistros(idCurso: string): Promise<RegistroAcademico[]>;
  /** Filas omitidas en la última lectura, por causa. */
  omisionesUltimaLectura(): OmisionesLectura;
}

export const CONECTOR_BD_INSTITUCIONAL = Symbol('ConectorBDInstitucional');

/**
 * Causas de omisión de una fila de la fuente (desglose estructurado aprobado
 * por Ivan, respuesta 3). `calificacionAsistencia` usa el mensaje del ER; las
 * demás, el mensaje genérico aprobado.
 */
export interface OmisionesLectura {
  calificacionAsistencia: number;
  identificacion: number;
  correo: number;
  fechaNacimiento: number;
  programa: number;
  datosInconsistentesEstudiante: number;
}

export function omisionesVacias(): OmisionesLectura {
  return {
    calificacionAsistencia: 0,
    identificacion: 0,
    correo: 0,
    fechaNacimiento: 0,
    programa: 0,
    datosInconsistentesEstudiante: 0,
  };
}

/** Mensajes de error de la Tabla 2 del ER (textuales). */
export const MENSAJES_TABLA_2 = {
  conexionEstablecida:
    'Conexión establecida correctamente con la base de datos institucional.',
  sinConexion:
    'No fue posible establecer conexión con la base de datos institucional (Tiempo de espera agotado).',
  credenciales: 'Credenciales de acceso o permisos insuficientes.',
  estructura:
    'Estructura de datos no reconocida: Faltan columnas requeridas en las tablas de origen.',
} as const;

/** Error del conector con uno de los mensajes de la Tabla 2. */
export class ErrorConectorInstitucional extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorConectorInstitucional';
  }
}
