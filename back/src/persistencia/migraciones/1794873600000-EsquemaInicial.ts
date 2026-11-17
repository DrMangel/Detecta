import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial de DETECTA (fase B2). La ejecuta `detecta_migrador`, dueño
 * de las tablas; la aplicación usa `detecta_app`, que solo recibe SELECT,
 * INSERT y UPDATE (ER 3.7 c: el historial no se elimina).
 *
 * Integridad:
 * - D7 (resuelta por Ivan): `caso_riesgo.id_origen` NOT NULL UNIQUE hacia
 *   `origen_riesgo` (tabla única de alertas y solicitudes). Una sola columna
 *   garantiza exactamente un origen; UNIQUE, como máximo un caso por origen.
 *   No hay columna de docente en `caso_riesgo`.
 * - ER 3.5.5: registro con estudiante y curso válidos, alerta con registro,
 *   correo único.
 * - ER Tabla 2: rangos de nota (0 a 5) y asistencia (0 a 100).
 * - Los enumerados son varchar con CHECK (plan de B2).
 */
export class EsquemaInicial1794873600000 implements MigrationInterface {
  name = 'EsquemaInicial1794873600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE programa (
        id_programa varchar(36) PRIMARY KEY,
        nombre varchar(150) NOT NULL
      );

      CREATE TABLE persona (
        id varchar(36) PRIMARY KEY,
        rol varchar(20) NOT NULL
          CHECK (rol IN ('ESTUDIANTE', 'DOCENTE', 'JEFE_DEPARTAMENTO', 'PSICOLOGO')),
        nombre varchar(150) NOT NULL,
        correo varchar(100) NOT NULL CONSTRAINT uq_persona_correo UNIQUE,
        contrasena_hash varchar(255) NOT NULL,
        fecha_nacimiento date,
        id_programa varchar(36) REFERENCES programa (id_programa),
        id_programa_dirigido varchar(36)
          CONSTRAINT uq_persona_programa_dirigido UNIQUE
          REFERENCES programa (id_programa),
        -- Columnas exclusivas de cada subclase (herencia de tabla única).
        CONSTRAINT ck_persona_subtipo CHECK (
          (rol = 'ESTUDIANTE' AND fecha_nacimiento IS NOT NULL
             AND id_programa IS NOT NULL AND id_programa_dirigido IS NULL)
          OR (rol = 'JEFE_DEPARTAMENTO' AND id_programa_dirigido IS NOT NULL
             AND fecha_nacimiento IS NULL AND id_programa IS NULL)
          OR (rol IN ('DOCENTE', 'PSICOLOGO') AND fecha_nacimiento IS NULL
             AND id_programa IS NULL AND id_programa_dirigido IS NULL)
        )
      );
      CREATE INDEX ix_persona_rol ON persona (rol);
      CREATE INDEX ix_persona_id_programa ON persona (id_programa);

      CREATE TABLE curso (
        id_curso varchar(36) PRIMARY KEY,
        nombre varchar(150) NOT NULL,
        periodo varchar(20) NOT NULL,
        ultima_sincronizacion timestamptz,
        id_docente varchar(36) NOT NULL REFERENCES persona (id)
      );
      CREATE INDEX ix_curso_id_docente ON curso (id_docente);
      CREATE INDEX ix_curso_periodo ON curso (periodo);

      CREATE TABLE registro_academico (
        id_registro varchar(36) PRIMARY KEY,
        nota numeric(3, 2) NOT NULL CHECK (nota BETWEEN 0 AND 5),
        porcentaje_asistencia numeric(5, 2) NOT NULL
          CHECK (porcentaje_asistencia BETWEEN 0 AND 100),
        id_estudiante varchar(36) NOT NULL REFERENCES persona (id),
        id_curso varchar(36) NOT NULL REFERENCES curso (id_curso),
        CONSTRAINT uq_registro_estudiante_curso UNIQUE (id_estudiante, id_curso)
      );
      CREATE INDEX ix_registro_id_curso ON registro_academico (id_curso);

      CREATE TABLE origen_riesgo (
        id_origen varchar(36) PRIMARY KEY,
        tipo varchar(20) NOT NULL CHECK (tipo IN ('ALERTA', 'SOLICITUD')),
        fecha timestamptz NOT NULL,
        estado varchar(20) NOT NULL CHECK (estado IN ('PENDIENTE', 'ATENDIDO')),
        nivel_riesgo varchar(20) CHECK (nivel_riesgo IN ('BAJO', 'MEDIO', 'ALTO')),
        descripcion text,
        id_docente varchar(36) REFERENCES persona (id),
        id_registro varchar(36) REFERENCES registro_academico (id_registro),
        tipo_apoyo varchar(20) CHECK (tipo_apoyo IN ('ACADEMICA', 'PSICOLOGICA')),
        motivo text,
        disponibilidad text,
        id_estudiante varchar(36) REFERENCES persona (id),
        -- Columnas exclusivas de cada subtipo; la alerta exige registro (ER 3.5.5).
        CONSTRAINT ck_origen_subtipo CHECK (
          (tipo = 'ALERTA' AND nivel_riesgo IS NOT NULL AND descripcion IS NOT NULL
             AND id_docente IS NOT NULL AND id_registro IS NOT NULL
             AND tipo_apoyo IS NULL AND motivo IS NULL
             AND disponibilidad IS NULL AND id_estudiante IS NULL)
          OR (tipo = 'SOLICITUD' AND tipo_apoyo IS NOT NULL AND motivo IS NOT NULL
             AND disponibilidad IS NOT NULL AND id_estudiante IS NOT NULL
             AND nivel_riesgo IS NULL AND descripcion IS NULL
             AND id_docente IS NULL AND id_registro IS NULL)
        )
      );
      CREATE INDEX ix_origen_id_docente ON origen_riesgo (id_docente);
      CREATE INDEX ix_origen_id_registro ON origen_riesgo (id_registro);
      CREATE INDEX ix_origen_id_estudiante ON origen_riesgo (id_estudiante);

      CREATE TABLE caso_riesgo (
        id_caso varchar(36) PRIMARY KEY,
        fecha_creacion timestamptz NOT NULL,
        motivo text NOT NULL CHECK (btrim(motivo) <> ''),
        nivel_riesgo varchar(20) CHECK (nivel_riesgo IN ('BAJO', 'MEDIO', 'ALTO')),
        ruta varchar(20) CHECK (ruta IN ('ACADEMICA', 'PSICOLOGICA')),
        estado varchar(20) NOT NULL CHECK (estado IN (
          'PENDIENTE', 'EN_NIVELACION', 'EN_EVALUACION', 'CITADO',
          'EN_SEGUIMIENTO', 'CERRADO', 'ARCHIVADO', 'REORIENTADO')),
        justificacion text NOT NULL,
        confidencialidad boolean NOT NULL,
        consentimiento_confirmado boolean NOT NULL,
        id_estudiante varchar(36) NOT NULL REFERENCES persona (id),
        -- D7: exactamente un origen y como máximo un caso por origen.
        id_origen varchar(36) NOT NULL
          CONSTRAINT uq_caso_origen UNIQUE
          REFERENCES origen_riesgo (id_origen),
        id_psicologo varchar(36) REFERENCES persona (id),
        -- Jefe que canaliza ("canaliza", 0..1), derivado en el adaptador.
        id_jefe varchar(36) REFERENCES persona (id)
      );
      CREATE INDEX ix_caso_id_estudiante ON caso_riesgo (id_estudiante);
      CREATE INDEX ix_caso_id_psicologo ON caso_riesgo (id_psicologo);
      CREATE INDEX ix_caso_id_jefe ON caso_riesgo (id_jefe);
      CREATE INDEX ix_caso_estado_ruta ON caso_riesgo (estado, ruta);

      CREATE TABLE cita (
        id_cita varchar(36) PRIMARY KEY,
        fecha_hora timestamptz NOT NULL,
        modalidad varchar(20) NOT NULL CHECK (modalidad IN ('PRESENCIAL', 'VIRTUAL')),
        estado varchar(20) NOT NULL
          CHECK (estado IN ('PROGRAMADA', 'REPROGRAMADA', 'CERRADA')),
        id_caso varchar(36) NOT NULL REFERENCES caso_riesgo (id_caso),
        id_psicologo varchar(36) NOT NULL REFERENCES persona (id)
      );
      CREATE INDEX ix_cita_id_caso ON cita (id_caso);
      CREATE INDEX ix_cita_id_psicologo ON cita (id_psicologo);

      CREATE TABLE asesoria (
        id_asesoria varchar(36) PRIMARY KEY,
        fecha timestamptz NOT NULL,
        tipo_asesoria varchar(20) NOT NULL
          CHECK (tipo_asesoria IN ('ORIENTACION', 'SEGUIMIENTO')),
        observaciones text NOT NULL,
        acuerdos text NOT NULL,
        asistencia boolean NOT NULL,
        requiere_seguimiento boolean NOT NULL,
        presenta_riesgo_critico boolean NOT NULL,
        id_cita varchar(36) NOT NULL
          CONSTRAINT uq_asesoria_cita UNIQUE
          REFERENCES cita (id_cita)
      );

      CREATE TABLE plan_nivelacion (
        id_plan varchar(36) PRIMARY KEY,
        descripcion text NOT NULL,
        fecha timestamptz NOT NULL,
        cronograma text NOT NULL,
        tutor_nombre varchar(150) NOT NULL,
        tutor_codigo varchar(20) NOT NULL,
        estado varchar(20) NOT NULL CHECK (estado IN ('ACTIVO', 'FINALIZADO')),
        id_caso varchar(36) NOT NULL REFERENCES caso_riesgo (id_caso),
        -- Jefe que lo estructura ("estructura", 1), derivado en el adaptador.
        id_jefe varchar(36) NOT NULL REFERENCES persona (id)
      );
      CREATE INDEX ix_plan_id_caso ON plan_nivelacion (id_caso);
      CREATE INDEX ix_plan_id_jefe ON plan_nivelacion (id_jefe);

      CREATE TABLE plan_nivelacion_curso (
        id_plan varchar(36) NOT NULL REFERENCES plan_nivelacion (id_plan),
        id_curso varchar(36) NOT NULL REFERENCES curso (id_curso),
        PRIMARY KEY (id_plan, id_curso)
      );
      CREATE INDEX ix_plan_curso_id_curso ON plan_nivelacion_curso (id_curso);

      CREATE TABLE informe_riesgo (
        id_informe varchar(36) PRIMARY KEY,
        fecha timestamptz NOT NULL,
        periodo varchar(20) NOT NULL,
        total_alertas integer NOT NULL CHECK (total_alertas >= 0),
        total_casos integer NOT NULL CHECK (total_casos >= 0),
        total_planes integer NOT NULL CHECK (total_planes >= 0),
        resumen text NOT NULL,
        id_curso varchar(36) NOT NULL REFERENCES curso (id_curso)
      );
      CREATE INDEX ix_informe_id_curso ON informe_riesgo (id_curso);

      CREATE TABLE informe_riesgo_caso (
        id_informe varchar(36) NOT NULL REFERENCES informe_riesgo (id_informe),
        id_caso varchar(36) NOT NULL REFERENCES caso_riesgo (id_caso),
        PRIMARY KEY (id_informe, id_caso)
      );
      CREATE INDEX ix_informe_caso_id_caso ON informe_riesgo_caso (id_caso);

      CREATE TABLE informe_riesgo_plan (
        id_informe varchar(36) NOT NULL REFERENCES informe_riesgo (id_informe),
        id_plan varchar(36) NOT NULL REFERENCES plan_nivelacion (id_plan),
        PRIMARY KEY (id_informe, id_plan)
      );
      CREATE INDEX ix_informe_plan_id_plan ON informe_riesgo_plan (id_plan);

      -- Usuario de la aplicación: sin DELETE ni TRUNCATE (ER 3.7 c).
      GRANT SELECT, INSERT, UPDATE ON
        programa, persona, curso, registro_academico, origen_riesgo,
        caso_riesgo, cita, asesoria, plan_nivelacion, plan_nivelacion_curso,
        informe_riesgo, informe_riesgo_caso, informe_riesgo_plan
      TO detecta_app;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE informe_riesgo_plan;
      DROP TABLE informe_riesgo_caso;
      DROP TABLE informe_riesgo;
      DROP TABLE plan_nivelacion_curso;
      DROP TABLE plan_nivelacion;
      DROP TABLE asesoria;
      DROP TABLE cita;
      DROP TABLE caso_riesgo;
      DROP TABLE origen_riesgo;
      DROP TABLE registro_academico;
      DROP TABLE curso;
      DROP TABLE persona;
      DROP TABLE programa;
    `);
  }
}
