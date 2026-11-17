/**
 * Contrato genérico `Repositorio<T>` (diagrama de clases v3).
 *
 * Adaptaciones aprobadas en el plan de B2:
 * - Los métodos devuelven `Promise` porque el acceso a la BD es asíncrono.
 * - `buscarPorId` devuelve `null` si no existe.
 * - `listar(criterios)`: filtros de igualdad combinados con AND. Cada
 *   repositorio tiene una lista blanca de claves (nombres de atributos del
 *   dominio); una clave desconocida lanza `Error`.
 *
 * Cada implementación documenta qué escribe `guardar()` en cascada y qué no.
 */
export type CriteriosBusqueda = ReadonlyMap<string, unknown>;

export interface Repositorio<T> {
  buscarPorId(id: string): Promise<T | null>;
  guardar(entidad: T): Promise<void>;
  listar(criterios: CriteriosBusqueda): Promise<T[]>;
}
