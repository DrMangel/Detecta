import {
  IsNull,
  type DataSource,
  type EntityManager,
  type EntityTarget,
  type ObjectLiteral,
} from 'typeorm';
import type {
  CriteriosBusqueda,
  Repositorio,
} from '../dominio/repositorios/repositorio';
import { CargadorGrafo } from './mapeadores/cargador-grafo';

export interface OpcionesRepositorioPersistente<T> {
  /** Entidad TypeORM (esquema o modelo) que consulta `listar()`. */
  objetivo: EntityTarget<ObjectLiteral>;
  /** Propiedad de la clave primaria en el esquema. */
  propiedadId: string;
  /**
   * Lista blanca de `listar(criterios)`: atributo del dominio → propiedad del
   * esquema. Una clave fuera de la lista lanza Error, para que nunca llegue
   * un nombre de columna arbitrario a la consulta (respuesta 7d de Ivan).
   */
  criterios: Readonly<Record<string, string>>;
  /** Reconstruye las entidades de dominio (grafo completo, sin N+1). */
  cargar(cargador: CargadorGrafo, ids: readonly string[]): Promise<T[]>;
  /** Escribe la entidad (y su cascada documentada) dentro de una transacción. */
  escribir(manager: EntityManager, entidad: T): Promise<void>;
}

const TIPOS_PERMITIDOS = new Set(['string', 'number', 'boolean']);

/**
 * Adaptador «Adaptador» `RepositorioPersistente<T>` del diagrama de clases v3:
 * base genérica que realiza `Repositorio<T>`. Según la nota del diagrama,
 * cada interfaz especializada se implementa con un adaptador que la extiende
 * (aprobado por Ivan en el plan de B2). Las entidades sin contrato
 * especializado (Programa, Curso, Cita, Asesoria, InformeRiesgo) usan
 * instancias de esta clase sin subclase (ver repositorios-genericos.ts).
 *
 * El dominio no conoce TypeORM: esta clase recibe y devuelve entidades de
 * dominio y delega la conversión en el cargador y los escritores.
 */
export class RepositorioPersistente<T> implements Repositorio<T> {
  constructor(
    protected readonly fuente: DataSource,
    private readonly opciones: OpcionesRepositorioPersistente<T>,
  ) {}

  async buscarPorId(id: string): Promise<T | null> {
    const [entidad] = await this.cargarPorIds([id]);
    return entidad ?? null;
  }

  async guardar(entidad: T): Promise<void> {
    await this.fuente.transaction((manager) =>
      this.opciones.escribir(manager, entidad),
    );
  }

  async listar(criterios: CriteriosBusqueda): Promise<T[]> {
    const donde: Record<string, unknown> = {};
    for (const [clave, valor] of criterios) {
      const propiedad = Object.hasOwn(this.opciones.criterios, clave)
        ? this.opciones.criterios[clave]
        : undefined;
      if (propiedad === undefined) {
        throw new Error(`Criterio no permitido en listar(): ${clave}`);
      }
      if (valor !== null && !TIPOS_PERMITIDOS.has(typeof valor)) {
        throw new Error(
          `El criterio ${clave} debe ser texto, número, booleano o null`,
        );
      }
      donde[propiedad] = valor === null ? IsNull() : valor;
    }
    const { propiedadId } = this.opciones;
    const filas = await this.fuente.manager.find(this.opciones.objetivo, {
      select: { [propiedadId]: true },
      where: donde,
      order: { [propiedadId]: 'ASC' },
    });
    return this.cargarPorIds(filas.map((fila) => String(fila[propiedadId])));
  }

  /** Reconstruye entidades por id con un cargador nuevo (una operación). */
  protected cargarPorIds(ids: readonly string[]): Promise<T[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.opciones.cargar(new CargadorGrafo(this.fuente.manager), ids);
  }

  /** Ejecuta una consulta de identificadores y carga sus entidades. */
  protected async cargarConsulta(
    sql: string,
    parametros: readonly unknown[],
  ): Promise<T[]> {
    const filas: { id: string }[] = await this.fuente.query(sql, [
      ...parametros,
    ]);
    return this.cargarPorIds(filas.map((fila) => fila.id));
  }
}
