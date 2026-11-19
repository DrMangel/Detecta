import type { DataSource } from 'typeorm';
import {
  BloqueoAgotadoError,
  RecursoOcupadoError,
  type OpcionesUnidadTrabajo,
  type RepositoriosTransaccionales,
  type UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import {
  crearRepositorioAsesoria,
  crearRepositorioCita,
  crearRepositorioCurso,
} from './repositorios-genericos';
import {
  RepositorioPersistenteAlerta,
  RepositorioPersistenteCasoRiesgo,
  RepositorioPersistentePersona,
  RepositorioPersistenteRegistroAcademico,
  RepositorioPersistenteSolicitud,
} from './repositorios-persistentes';

/**
 * Adaptador de `UnidadTrabajo` (B4; fuera del diagrama, aprobado por Ivan).
 * Abre una transacción y entrega repositorios ligados a su EntityManager:
 * todo se confirma o se revierte junto (ER 3.7 a).
 */
/**
 * Espacio de claves de los bloqueos con espera de B7: forma de dos enteros
 * de pg_advisory_xact_lock, que no se cruza con la de un entero (bigint) que
 * usa el bloqueo de la sincronización (B4).
 */
export const ESPACIO_BLOQUEOS_CASOS = 7;

/** Espera máxima de un bloqueo en milisegundos (ajuste B; ER 3.4: 5 s). */
export const ESPERA_MAXIMA_BLOQUEO_MS = 5000;

/** SQLSTATE de PostgreSQL: lock_not_available (venció lock_timeout). */
const BLOQUEO_NO_DISPONIBLE = '55P03';

export class UnidadTrabajoPersistente implements UnidadTrabajo {
  constructor(
    private readonly fuente: DataSource,
    /** Solo las pruebas la acortan, para comprobar el vencimiento. */
    private readonly esperaMaximaBloqueoMs = ESPERA_MAXIMA_BLOQUEO_MS,
  ) {}

  ejecutar<R>(
    trabajo: (repositorios: RepositoriosTransaccionales) => Promise<R>,
    opciones: OpcionesUnidadTrabajo = {},
  ): Promise<R> {
    return this.#transaccion(trabajo, opciones).catch((error: unknown) => {
      const codigo = (error as { driverError?: { code?: unknown } }).driverError
        ?.code;
      if (codigo === BLOQUEO_NO_DISPONIBLE) {
        throw new BloqueoAgotadoError();
      }
      throw error;
    });
  }

  #transaccion<R>(
    trabajo: (repositorios: RepositoriosTransaccionales) => Promise<R>,
    opciones: OpcionesUnidadTrabajo,
  ): Promise<R> {
    return this.fuente.transaction(async (manager) => {
      if (opciones.bloqueos && opciones.bloqueos.length > 0) {
        // SET no admite parámetros: el valor es un entero propio, no una entrada.
        await manager.query(
          `SET LOCAL lock_timeout = ${Math.trunc(this.esperaMaximaBloqueoMs)}`,
        );
        for (const clave of opciones.bloqueos) {
          await manager.query(
            'SELECT pg_advisory_xact_lock($1::int, hashtext($2))',
            [ESPACIO_BLOQUEOS_CASOS, clave],
          );
        }
      }
      if (opciones.bloqueoExclusivo) {
        // Bloqueo de la transacción: se libera solo al confirmar o revertir.
        const [fila] = await manager.query<{ obtenido: boolean }[]>(
          'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS obtenido',
          [opciones.bloqueoExclusivo],
        );
        if (fila?.obtenido !== true) {
          throw new RecursoOcupadoError(
            `El recurso "${opciones.bloqueoExclusivo}" está en uso`,
          );
        }
      }
      return trabajo({
        personas: new RepositorioPersistentePersona(manager),
        registros: new RepositorioPersistenteRegistroAcademico(manager),
        cursos: crearRepositorioCurso(manager),
        alertas: new RepositorioPersistenteAlerta(manager),
        solicitudes: new RepositorioPersistenteSolicitud(manager),
        casos: new RepositorioPersistenteCasoRiesgo(manager),
        citas: crearRepositorioCita(manager),
        asesorias: crearRepositorioAsesoria(manager),
      });
    });
  }
}
