import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Autoría y programa del informe de riesgo (fase B8, respuesta 4 y ajuste B
 * de Ivan). Diagrama de entidades: JefeDepartamento (0..1) y Psicologo (0..1)
 * "genera" InformeRiesgo. El programa del informe permite que el Jefe solo
 * exporte los de su programa.
 *
 * - Columnas nuevas, primero admitiendo nulos.
 * - Relleno de filas existentes: el programa sale del estudiante de un caso o
 *   de un plan que el informe resume, y el autor es el Jefe de ese programa.
 *   Si una fila no puede rellenarse, la migración se detiene con un mensaje
 *   explicativo (no inventa datos).
 * - Después: `id_programa` NOT NULL y CHECK de que exactamente uno de
 *   `id_jefe` e `id_psicologo` está lleno.
 * - Sin GRANT nuevo: son columnas de `informe_riesgo`, cuyo permiso de tabla
 *   (SELECT, INSERT, UPDATE) ya tiene detecta_app.
 */
export class AutoriaInforme1794884400000 implements MigrationInterface {
  name = 'AutoriaInforme1794884400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE informe_riesgo
        ADD COLUMN id_programa varchar(36) REFERENCES programa (id_programa),
        ADD COLUMN id_jefe varchar(36) REFERENCES persona (id),
        ADD COLUMN id_psicologo varchar(36) REFERENCES persona (id);

      UPDATE informe_riesgo i SET id_programa = (
        SELECT e.id_programa FROM informe_riesgo_caso ic
        JOIN caso_riesgo c ON c.id_caso = ic.id_caso
        JOIN persona e ON e.id = c.id_estudiante
        WHERE ic.id_informe = i.id_informe
        UNION ALL
        SELECT e.id_programa FROM informe_riesgo_plan ip
        JOIN plan_nivelacion p ON p.id_plan = ip.id_plan
        JOIN caso_riesgo c ON c.id_caso = p.id_caso
        JOIN persona e ON e.id = c.id_estudiante
        WHERE ip.id_informe = i.id_informe
        LIMIT 1
      )
      WHERE i.id_programa IS NULL;

      UPDATE informe_riesgo i SET id_jefe = (
        SELECT j.id FROM persona j
        WHERE j.rol = 'JEFE_DEPARTAMENTO'
          AND j.id_programa_dirigido = i.id_programa
        LIMIT 1
      )
      WHERE i.id_jefe IS NULL AND i.id_psicologo IS NULL;

      DO $$
      DECLARE sin_rellenar integer;
      BEGIN
        SELECT count(*) INTO sin_rellenar FROM informe_riesgo
        WHERE id_programa IS NULL OR (id_jefe IS NULL AND id_psicologo IS NULL);
        IF sin_rellenar > 0 THEN
          RAISE EXCEPTION
            'AutoriaInforme: % informe(s) existente(s) sin programa o autor deducible; revíselos antes de migrar',
            sin_rellenar;
        END IF;
      END $$;

      ALTER TABLE informe_riesgo
        ALTER COLUMN id_programa SET NOT NULL,
        ADD CONSTRAINT ck_informe_un_autor CHECK (
          (id_jefe IS NULL) <> (id_psicologo IS NULL)
        );
      CREATE INDEX ix_informe_id_programa ON informe_riesgo (id_programa);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX ix_informe_id_programa;
      ALTER TABLE informe_riesgo
        DROP CONSTRAINT ck_informe_un_autor,
        DROP COLUMN id_psicologo,
        DROP COLUMN id_jefe,
        DROP COLUMN id_programa;
    `);
  }
}
