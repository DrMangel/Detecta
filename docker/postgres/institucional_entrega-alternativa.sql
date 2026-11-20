-- Variante ficticia para verificar Manual 4.1.1.8 / ER 3.7 e.
-- Mantiene la carga principal de la Tabla 25 en tablas y vista separadas.
\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE IF NOT EXISTS matricula_institucional_alternativa (
  codigo_estudiante varchar(40),
  nombre_completo varchar(200),
  correo_contacto varchar(200),
  nacimiento_estudiante date,
  programa varchar(150),
  asignatura varchar(40),
  nota_acumulada numeric(5, 2),
  asistencia_porcentaje numeric(6, 2),
  semestre integer,
  creditos integer,
  estado_matricula varchar(20),
  docente_codigo varchar(40),
  docente_nombre varchar(150)
);

CREATE OR REPLACE VIEW vista_estudiantes_entrega_alternativa AS
  SELECT codigo_estudiante, nombre_completo, correo_contacto,
         nacimiento_estudiante, programa, asignatura, nota_acumulada,
         asistencia_porcentaje
  FROM matricula_institucional_alternativa
  WHERE estado_matricula = 'ACTIVA';

REVOKE ALL ON matricula_institucional_alternativa
  FROM PUBLIC, institucional_lector;
REVOKE ALL ON vista_estudiantes_entrega_alternativa
  FROM PUBLIC, institucional_lector;
GRANT SELECT ON vista_estudiantes_entrega_alternativa
  TO institucional_lector;

TRUNCATE matricula_institucional_alternativa;
COPY matricula_institucional_alternativa FROM STDIN WITH (FORMAT csv, HEADER true);
