/**
 * Nombre de la conexión TypeORM a la base que simula la BD institucional
 * (B0). La conexión por defecto (sin nombre) es la base propia `detecta`.
 * Está en un archivo propio para que `integracion/` la use sin importar
 * `app.module.ts` (evita un ciclo de importación).
 */
export const CONEXION_INSTITUCIONAL = 'institucional';

/** ER Tabla 2: conexión con la BD institucional en menos de 5 segundos. */
export const TIEMPO_CONEXION_INSTITUCIONAL_MS = 5000;
