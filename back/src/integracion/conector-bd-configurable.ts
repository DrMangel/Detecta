import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  ErrorConectorInstitucional,
  MENSAJES_TABLA_2,
  omisionesVacias,
  type ConectorBDInstitucional,
  type OmisionesLectura,
} from '../aplicacion/contratos/conector-bd-institucional';
import { HASH_SIN_ACTIVAR } from '../aplicacion/servicios/hash-contrasenas';
import type { Curso } from '../dominio/entidades/curso';
import { Estudiante } from '../dominio/entidades/estudiante';
import type { Programa } from '../dominio/entidades/programa';
import { RegistroAcademico } from '../dominio/entidades/registro-academico';
import type { Repositorio } from '../dominio/repositorios/repositorio';
import {
  CAMPOS_TABLA_2,
  citarIdentificador,
  type CampoTabla2,
  type ConfiguracionConector,
} from './configuracion-conector';

export interface DependenciasConector {
  /** Conexión `institucional` de B0: solo lectura (usuario y sesión). */
  fuente: DataSource;
  configuracion: ConfiguracionConector;
  programas: Repositorio<Programa>;
  cursos: Repositorio<Curso>;
  reloj: () => Date;
}

type Fila = Record<CampoTabla2, unknown>;
type CausaOmision = keyof OmisionesLectura;

/** Bogotá: UTC-5 todo el año (sin horario de verano). */
const DESFASE_BOGOTA_MS = -5 * 60 * 60 * 1000;

// Rangos válidos de la Tabla 2 del ER.
const FORMATO_ID = /^[A-Za-z0-9]{5,20}$/;
const FORMATO_NOMBRE = /^[\p{L}]+(?: [\p{L}]+)*$/u;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adaptador `ConectorBDConfigurable` (diagrama de clases v3:
 * `-mapeoCampos: Map`, `-parametrosConexion: Map`). Lee el origen de la
 * institución SOLO con SELECT, mediante el mapeo de campos, sin pedir cambios
 * a su esquema (ER 3.6.3, 3.7 e; Manual 4.1.1.8).
 *
 * Valida cada fila con los rangos de la Tabla 2 del ER y omite (y cuenta por
 * causa) las inválidas: "Registros fuera de rango se omiten con advertencia"
 * (línea base §6). Los estudiantes que construye llevan el hash centinela de
 * cuenta sin activar (D6): la regla de persistencia de B4 impide que pise el
 * hash de una cuenta ya activada.
 */
export class ConectorBDConfigurable implements ConectorBDInstitucional {
  readonly #mapeoCampos: ReadonlyMap<CampoTabla2, string>;
  readonly #parametrosConexion: ReadonlyMap<string, unknown>;
  readonly #fuente: DataSource;
  readonly #origen: string;
  readonly #programas: Repositorio<Programa>;
  readonly #cursos: Repositorio<Curso>;
  readonly #reloj: () => Date;
  #omisiones: OmisionesLectura = omisionesVacias();

  constructor(dependencias: DependenciasConector) {
    this.#fuente = dependencias.fuente;
    this.#origen = dependencias.configuracion.origen;
    this.#mapeoCampos = new Map(
      Object.entries(dependencias.configuracion.mapeoCampos) as [
        CampoTabla2,
        string,
      ][],
    );
    // Parámetros informativos de la conexión, nunca la contraseña.
    const opciones = dependencias.fuente.options as unknown as Record<
      string,
      unknown
    >;
    this.#parametrosConexion = new Map<string, unknown>([
      ['motor', opciones['type']],
      ['servidor', opciones['host']],
      ['puerto', opciones['port']],
      ['baseDatos', opciones['database']],
      ['usuario', opciones['username']],
      ['origen', this.#origen],
    ]);
    this.#programas = dependencias.programas;
    this.#cursos = dependencias.cursos;
    this.#reloj = dependencias.reloj;
  }

  get parametrosConexion(): ReadonlyMap<string, unknown> {
    return this.#parametrosConexion;
  }

  /**
   * Conecta y verifica que el origen tenga todas las columnas mapeadas
   * (consulta con LIMIT 0, sin leer datos).
   */
  async conectar(): Promise<boolean> {
    try {
      if (!this.#fuente.isInitialized) {
        await this.#fuente.initialize();
      }
      await this.#fuente.query(`${this.#select()} LIMIT 0`);
      return true;
    } catch (error) {
      throw traducirError(error);
    }
  }

  async obtenerEstudiantes(idCurso: string): Promise<Estudiante[]> {
    const registros = await this.obtenerRegistros(idCurso);
    const porId = new Map<string, Estudiante>();
    for (const registro of registros) {
      porId.set(registro.estudiante.id, registro.estudiante);
    }
    return [...porId.values()];
  }

  async obtenerRegistros(idCurso: string): Promise<RegistroAcademico[]> {
    this.#omisiones = omisionesVacias();
    const curso = await this.#cursos.buscarPorId(idCurso);
    if (curso === null) {
      throw new Error(`El curso ${idCurso} no está configurado en DETECTA`);
    }
    let filas: Fila[];
    try {
      filas = await this.#fuente.query<Fila[]>(
        `${this.#select()} WHERE ${citarIdentificador(this.#columna('codigo_asignatura'))} = $1`,
        [idCurso],
      );
    } catch (error) {
      throw traducirError(error);
    }
    const programas = await this.#programas.listar(new Map());
    const hoy = fechaBogota(this.#reloj());

    const registros: RegistroAcademico[] = [];
    for (const fila of filas) {
      const resultado = validarFila(fila, programas, hoy);
      if ('causa' in resultado) {
        this.#omisiones[resultado.causa] += 1;
        continue;
      }
      const estudiante = new Estudiante({
        id: resultado.id,
        nombre: resultado.nombre,
        correo: resultado.correo,
        contrasenaHash: HASH_SIN_ACTIVAR,
        fechaNacimiento: resultado.fechaNacimiento,
        programa: resultado.programa,
      });
      registros.push(
        new RegistroAcademico({
          // Id provisional: el servicio reutiliza el del registro existente.
          idRegistro: randomUUID(),
          nota: resultado.nota,
          porcentajeAsistencia: resultado.asistencia,
          estudiante,
          curso,
        }),
      );
    }
    return registros;
  }

  omisionesUltimaLectura(): OmisionesLectura {
    return { ...this.#omisiones };
  }

  #columna(campo: CampoTabla2): string {
    const columna = this.#mapeoCampos.get(campo);
    if (columna === undefined) {
      throw new Error(`Falta el mapeo del campo ${campo}`);
    }
    return columna;
  }

  /** SELECT de las columnas mapeadas, renombradas a los campos de la Tabla 2. */
  #select(): string {
    const columnas = CAMPOS_TABLA_2.map(
      (campo) =>
        `${citarIdentificador(this.#columna(campo))} AS ${citarIdentificador(campo)}`,
    );
    return `SELECT ${columnas.join(', ')} FROM ${citarIdentificador(this.#origen)}`;
  }
}

export interface FilaValida {
  id: string;
  nombre: string;
  correo: string;
  fechaNacimiento: Date;
  programa: Programa;
  nota: number;
  asistencia: number;
}

/**
 * Valida una fila con los rangos de la Tabla 2 del ER. Devuelve los datos
 * convertidos o la causa de omisión (respuesta 3 de Ivan).
 */
export function validarFila(
  fila: Fila,
  programas: readonly Programa[],
  hoyBogota: string,
): FilaValida | { causa: CausaOmision } {
  const id = texto(fila.id_estudiante);
  const nombre = texto(fila.nombre_estudiante).replace(/\s+/g, ' ');
  if (!FORMATO_ID.test(id)) {
    return { causa: 'identificacion' };
  }
  if (
    nombre.length < 2 ||
    nombre.length > 150 ||
    !FORMATO_NOMBRE.test(nombre)
  ) {
    return { causa: 'identificacion' };
  }

  const correo = texto(fila.correo_estudiante);
  if (correo.length > 100 || !FORMATO_CORREO.test(correo)) {
    return { causa: 'correo' };
  }

  const fecha = textoFecha(fila.fecha_nacimiento);
  if (fecha === null || fecha >= hoyBogota) {
    return { causa: 'fechaNacimiento' };
  }

  const programa = enlazarPrograma(texto(fila.programa_academico), programas);
  if (programa === null) {
    return { causa: 'programa' };
  }

  const nota = numero(fila.calificacion_acumulada);
  const asistencia = numero(fila.porcentaje_asistencia);
  if (
    nota === null ||
    nota < 0 ||
    nota > 5 ||
    asistencia === null ||
    asistencia < 0 ||
    asistencia > 100
  ) {
    return { causa: 'calificacionAsistencia' };
  }

  const [anio, mes, dia] = fecha.split('-').map(Number);
  return {
    id,
    nombre,
    correo,
    fechaNacimiento: new Date(anio ?? 0, (mes ?? 1) - 1, dia ?? 1),
    programa,
    nota,
    asistencia,
  };
}

/**
 * Enlace del programa (respuesta 1 de Ivan): primero `idPrograma` exacto; si
 * no, `nombre` normalizado (espacios, mayúsculas y tildes). Ninguno o varios
 * por nombre: null (la fila se omite).
 */
export function enlazarPrograma(
  valor: string,
  programas: readonly Programa[],
): Programa | null {
  if (valor.length < 3 || valor.length > 100) {
    return null;
  }
  const porId = programas.find((programa) => programa.idPrograma === valor);
  if (porId) {
    return porId;
  }
  const buscado = normalizar(valor);
  const porNombre = programas.filter(
    (programa) => normalizar(programa.nombre) === buscado,
  );
  return porNombre.length === 1 ? (porNombre[0] ?? null) : null;
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Fecha AAAA-MM-DD de un instante en hora de Bogotá. */
export function fechaBogota(instante: Date): string {
  return new Date(instante.getTime() + DESFASE_BOGOTA_MS)
    .toISOString()
    .slice(0, 10);
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

/** DATE de PostgreSQL: llega como Date (medianoche local) o como texto. */
function textoFecha(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const anio = String(valor.getFullYear()).padStart(4, '0');
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.slice(0, 10);
  }
  return null;
}

/** Traduce un error de conexión o consulta a los mensajes de la Tabla 2. */
export function traducirError(error: unknown): Error {
  if (error instanceof ErrorConectorInstitucional) {
    return error;
  }
  const detalle = error as {
    code?: string;
    driverError?: { code?: string };
    message?: string;
  };
  const codigo = detalle?.driverError?.code ?? detalle?.code ?? '';
  const mensaje = String(detalle?.message ?? '').toLowerCase();
  if (['28P01', '28000', '42501'].includes(codigo)) {
    return new ErrorConectorInstitucional(MENSAJES_TABLA_2.credenciales);
  }
  if (['42703', '42P01', '3F000'].includes(codigo)) {
    return new ErrorConectorInstitucional(MENSAJES_TABLA_2.estructura);
  }
  if (
    [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
      '57P03',
    ].includes(codigo) ||
    mensaje.includes('timeout') ||
    mensaje.includes('connect')
  ) {
    return new ErrorConectorInstitucional(MENSAJES_TABLA_2.sinConexion);
  }
  return error instanceof Error ? error : new Error(String(error));
}
