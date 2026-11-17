import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tokens de activación y recuperación de cuenta (D6, fase B3).
 *
 * - Solo el SHA-256 del token (`hash_token`, 64 hexadecimales, UNIQUE).
 * - Caducidad (`expira_en`, D16: 30 min), un solo uso (`usado_en`) y
 *   anulación al emitir otro (`anulado_en`). Nunca se borran filas.
 * - Convención del README: GRANT explícito a detecta_app con SELECT, INSERT
 *   y UPDATE; nunca DELETE ni TRUNCATE (ER 3.7 c).
 */
export class TokensActivacion1794877200000 implements MigrationInterface {
  name = 'TokensActivacion1794877200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE token_activacion (
        id_token varchar(36) PRIMARY KEY,
        id_persona varchar(36) NOT NULL REFERENCES persona (id),
        hash_token char(64) NOT NULL
          CONSTRAINT uq_token_hash UNIQUE
          CHECK (hash_token ~ '^[0-9a-f]{64}$'),
        creado_en timestamptz NOT NULL,
        expira_en timestamptz NOT NULL,
        usado_en timestamptz,
        anulado_en timestamptz,
        CONSTRAINT ck_token_vigencia CHECK (expira_en > creado_en)
      );
      CREATE INDEX ix_token_persona_creado ON token_activacion (id_persona, creado_en);

      GRANT SELECT, INSERT, UPDATE ON token_activacion TO detecta_app;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE token_activacion;');
  }
}
