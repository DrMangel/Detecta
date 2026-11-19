import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registro de eventos del caso (fase B9, trazabilidad; diseño aprobado por
 * Ivan en el informe parcial 1): ER 1.3.4 «Funciones de auditoría» y CUD04,
 * requisitos especiales. Ver aplicacion/contratos/registro-eventos-caso.ts.
 *
 * - Solo identificadores, el tipo y fechas; ningún contenido confidencial.
 * - `ocurrido_en` lo pone PostgreSQL (hora de la transacción).
 * - CHECKs por tipo: qué columnas van llenas en cada uno.
 * - Permisos: SELECT e INSERT, sin UPDATE ni DELETE. Excepción deliberada a la
 *   convención (SELECT, INSERT, UPDATE en las demás tablas): el registro es
 *   inmutable para la aplicación.
 * - No hay filas que rellenar: los eventos anteriores a esta migración no
 *   pueden reconstruirse (la fecha anterior de una reprogramación ya se
 *   sobrescribió).
 */
export class EventosCaso1794888000000 implements MigrationInterface {
  name = 'EventosCaso1794888000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE evento_caso (
        id_evento varchar(36) PRIMARY KEY,
        id_caso varchar(36) NOT NULL REFERENCES caso_riesgo (id_caso),
        id_actor varchar(36) NOT NULL REFERENCES persona (id),
        tipo varchar(30) NOT NULL CHECK (tipo IN (
          'DICTAMEN_APROBADO', 'DICTAMEN_ARCHIVADO', 'DICTAMEN_REORIENTADO',
          'CASO_CERRADO', 'PLAN_FINALIZADO', 'CITA_PROGRAMADA',
          'CITA_REPROGRAMADA'
        )),
        ocurrido_en timestamptz NOT NULL DEFAULT now(),
        id_plan varchar(36) REFERENCES plan_nivelacion (id_plan),
        id_cita varchar(36) REFERENCES cita (id_cita),
        fecha_hora_anterior timestamptz,
        fecha_hora_nueva timestamptz,
        modalidad_anterior varchar(20)
          CHECK (modalidad_anterior IN ('PRESENCIAL', 'VIRTUAL')),
        modalidad_nueva varchar(20)
          CHECK (modalidad_nueva IN ('PRESENCIAL', 'VIRTUAL')),
        CONSTRAINT ck_evento_plan CHECK (
          (tipo = 'PLAN_FINALIZADO') = (id_plan IS NOT NULL)
        ),
        CONSTRAINT ck_evento_cita CHECK (
          (tipo IN ('CITA_PROGRAMADA', 'CITA_REPROGRAMADA'))
            = (id_cita IS NOT NULL)
        ),
        CONSTRAINT ck_evento_reprogramacion CHECK (
          CASE WHEN tipo = 'CITA_REPROGRAMADA' THEN
            fecha_hora_anterior IS NOT NULL AND fecha_hora_nueva IS NOT NULL
              AND modalidad_anterior IS NOT NULL AND modalidad_nueva IS NOT NULL
          ELSE
            fecha_hora_anterior IS NULL AND fecha_hora_nueva IS NULL
              AND modalidad_anterior IS NULL AND modalidad_nueva IS NULL
          END
        )
      );
      CREATE INDEX ix_evento_caso_id_caso_ocurrido
        ON evento_caso (id_caso, ocurrido_en);

      -- Solo inserción (excepción aprobada): sin UPDATE, DELETE ni TRUNCATE.
      GRANT SELECT, INSERT ON evento_caso TO detecta_app;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE evento_caso;`);
  }
}
