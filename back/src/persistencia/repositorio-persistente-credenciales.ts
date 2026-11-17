import { IsNull } from 'typeorm';
import {
  accesoDatos,
  type AccesoDatos,
  type FuenteDatos,
} from './acceso-datos';
import type { RepositorioCredenciales } from '../dominio/repositorios/repositorio-credenciales';
import { EsquemaTokenActivacion, ModeloPersona } from './esquemas';

/**
 * Adaptador de `RepositorioCredenciales` (D6, B3; fuera del diagrama de
 * clases v3, aprobado por Ivan). Escribe `persona.contrasena_hash` y la tabla
 * `token_activacion`. Ninguna operación borra filas.
 */
export class RepositorioPersistenteCredenciales implements RepositorioCredenciales {
  readonly #acceso: AccesoDatos;

  constructor(fuente: FuenteDatos) {
    this.#acceso = accesoDatos(fuente);
  }

  async registrarToken(token: {
    idToken: string;
    idPersona: string;
    hashToken: string;
    creadoEn: Date;
    expiraEn: Date;
  }): Promise<void> {
    await this.#acceso.transaccion(async (m) => {
      // Al emitir un token nuevo se anulan los anteriores sin usar.
      await m.update(
        EsquemaTokenActivacion,
        { idPersona: token.idPersona, usadoEn: IsNull(), anuladoEn: IsNull() },
        { anuladoEn: token.creadoEn },
      );
      await m.insert(EsquemaTokenActivacion, {
        ...token,
        usadoEn: null,
        anuladoEn: null,
      });
    });
  }

  async contarTokensDesde(idPersona: string, desde: Date): Promise<number> {
    const [fila] = await this.#acceso.query<{ total: number }[]>(
      `SELECT count(*)::int AS total FROM token_activacion
       WHERE id_persona = $1 AND creado_en >= $2`,
      [idPersona, desde],
    );
    return fila?.total ?? 0;
  }

  async canjearToken(
    hashToken: string,
    contrasenaHash: string,
    ahora: Date,
  ): Promise<boolean> {
    return this.#acceso.transaccion(async (m) => {
      // Un solo UPDATE condicionado: dos canjes simultáneos del mismo token
      // no pueden tener éxito ambos (solo uno encuentra usado_en IS NULL).
      const resultado: unknown[] = await m.query(
        `UPDATE token_activacion
         SET usado_en = $2
         WHERE hash_token = $1
           AND usado_en IS NULL
           AND anulado_en IS NULL
           AND expira_en > $2
         RETURNING id_persona`,
        [hashToken, ahora],
      );
      // En PostgreSQL, TypeORM devuelve un UPDATE con RETURNING como
      // [filas, cantidad]; se aceptan también las filas directamente.
      const filas = (
        Array.isArray(resultado[0]) ? resultado[0] : resultado
      ) as { id_persona?: string }[];
      const idPersona = filas[0]?.id_persona;
      if (idPersona === undefined) {
        return false;
      }
      await m.update(ModeloPersona, { id: idPersona }, { contrasenaHash });
      return true;
    });
  }
}
