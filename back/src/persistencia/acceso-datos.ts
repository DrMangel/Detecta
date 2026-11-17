import { EntityManager, type DataSource } from 'typeorm';

/**
 * Fuente de datos de un repositorio: la conexión (cada `guardar` abre su
 * propia transacción) o el EntityManager de una transacción ya abierta por
 * `UnidadTrabajo` (B4; Manual 4.1.1.4: "los límites transaccionales los
 * definen los servicios y no los repositorios").
 */
export type FuenteDatos = DataSource | EntityManager;

export interface AccesoDatos {
  manager: EntityManager;
  /** Abre una transacción, o reutiliza la que ya está abierta. */
  transaccion<R>(trabajo: (manager: EntityManager) => Promise<R>): Promise<R>;
  query<R = unknown>(sql: string, parametros?: unknown[]): Promise<R>;
}

export function accesoDatos(fuente: FuenteDatos): AccesoDatos {
  if (fuente instanceof EntityManager) {
    return {
      manager: fuente,
      transaccion: (trabajo) => trabajo(fuente),
      query: (sql, parametros) => fuente.query(sql, parametros),
    };
  }
  return {
    manager: fuente.manager,
    transaccion: (trabajo) => fuente.transaction(trabajo),
    query: (sql, parametros) => fuente.query(sql, parametros),
  };
}
