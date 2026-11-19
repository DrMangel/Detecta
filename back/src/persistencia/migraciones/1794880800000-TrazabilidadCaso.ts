import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trazabilidad del caso (fase B7, respuesta 10 de Ivan): Manual CUD04
 * ("queda registrado quién canalizó el caso y en qué fecha") y CUD09 ("quién
 * confirmó el consentimiento y en qué fecha").
 *
 * - `fecha_canalizacion`: la fija el adaptador cuando el Jefe canaliza (quién
 *   ya está en `id_jefe`).
 * - `fecha_consentimiento` e `id_psicologo_consentimiento`: los fija el
 *   adaptador cuando el psicólogo confirma el consentimiento.
 * El dominio no los expone (como `id_jefe`). No hace falta GRANT nuevo: son
 * columnas de `caso_riesgo`, cuyo permiso de tabla (SELECT, INSERT, UPDATE)
 * ya tiene detecta_app.
 */
export class TrazabilidadCaso1794880800000 implements MigrationInterface {
  name = 'TrazabilidadCaso1794880800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE caso_riesgo
        ADD COLUMN fecha_canalizacion timestamptz,
        ADD COLUMN fecha_consentimiento timestamptz,
        ADD COLUMN id_psicologo_consentimiento varchar(36)
          REFERENCES persona (id),
        ADD CONSTRAINT ck_caso_consentimiento_trazado CHECK (
          (fecha_consentimiento IS NULL) = (id_psicologo_consentimiento IS NULL)
        );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE caso_riesgo
        DROP CONSTRAINT ck_caso_consentimiento_trazado,
        DROP COLUMN id_psicologo_consentimiento,
        DROP COLUMN fecha_consentimiento,
        DROP COLUMN fecha_canalizacion;
    `);
  }
}
