-- Bases de MEDICIÓN de B9 (ajuste G de Ivan): detecta_carga e
-- institucional_carga. Solo datos sintéticos; nunca detecta,
-- detecta_pruebas ni institucional_demo. Lo ejecuta preparar-bases-carga.mjs
-- como detecta_user (superusuario del contenedor). Idempotente.
\set ON_ERROR_STOP on

SELECT 'CREATE DATABASE detecta_carga OWNER detecta_migrador'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'detecta_carga')\gexec
REVOKE ALL ON DATABASE detecta_carga FROM PUBLIC;
GRANT CONNECT ON DATABASE detecta_carga TO detecta_app;

SELECT 'CREATE DATABASE institucional_carga OWNER detecta_user'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'institucional_carga')\gexec
REVOKE ALL ON DATABASE institucional_carga FROM PUBLIC;
GRANT CONNECT ON DATABASE institucional_carga TO institucional_lector;

\connect detecta_carga
GRANT USAGE ON SCHEMA public TO detecta_app;

\connect institucional_carga
GRANT USAGE ON SCHEMA public TO institucional_lector;

BEGIN;
-- Misma estructura que institucional_demo (docker/postgres/institucional_demo.sql).
CREATE TABLE IF NOT EXISTS matricula_institucional (
  id_estudiante varchar(40),
  nombre_estudiante varchar(200),
  correo_estudiante varchar(200),
  fecha_nacimiento date,
  programa_academico varchar(150),
  codigo_asignatura varchar(40),
  calificacion_acumulada numeric(5, 2),
  porcentaje_asistencia numeric(6, 2),
  semestre integer,
  creditos integer,
  estado_matricula varchar(20),
  id_docente varchar(40),
  nombre_docente varchar(150)
);
CREATE OR REPLACE VIEW vista_estudiantes_matriculados AS
  SELECT id_estudiante, nombre_estudiante, correo_estudiante, fecha_nacimiento,
         programa_academico, codigo_asignatura, calificacion_acumulada,
         porcentaje_asistencia
  FROM matricula_institucional
  WHERE estado_matricula = 'ACTIVA';
REVOKE ALL ON matricula_institucional FROM PUBLIC, institucional_lector;
REVOKE ALL ON vista_estudiantes_matriculados FROM PUBLIC, institucional_lector;
GRANT SELECT ON vista_estudiantes_matriculados TO institucional_lector;

-- 2040 matrículas sintéticas: 34 cursos (CARGA-01 a CARGA-34) de 60
-- estudiantes, un curso por estudiante (EC0001 a EC2040), programa ficticio.
TRUNCATE matricula_institucional;
INSERT INTO matricula_institucional
SELECT
  'EC' || lpad(n::text, 4, '0'),
  -- La regla de B4 solo admite letras en el nombre: el número se codifica en letras.
  'Estudiante Sintético ' || translate(lpad(n::text, 4, '0'), '0123456789', 'ABCDEFGHIJ'),
  'carga' || n || '@ejemplo.invalid',
  date '2000-01-01' + (n % 3000),
  'Programa de Carga',
  'CARGA-' || lpad((((n - 1) / 60) + 1)::text, 2, '0'),
  round((1 + (n % 400) / 100.0)::numeric, 2),
  round((40 + (n % 60))::numeric, 2),
  1, 3, 'ACTIVA', 'DOC-CARGA', 'Docente de Carga'
FROM generate_series(1, 2040) AS n;

-- Variante «realista» (ajuste 2 de Ivan; ER 3.4.1 c): 2000 estudiantes
-- (ER0001 a ER2000) en 25 programas de 80 (PR01 a PR25, enlazados por
-- idPrograma); 3 cursos por programa (REAL-PP-1 a 3) y cada estudiante en 2
-- de ellos: ~53 estudiantes por curso, 4000 matrículas.
INSERT INTO matricula_institucional
SELECT
  'ER' || lpad(n::text, 4, '0'),
  'Estudiante Realista ' || translate(lpad(n::text, 4, '0'), '0123456789', 'ABCDEFGHIJ'),
  'real' || n || '@ejemplo.invalid',
  date '2000-01-01' + (n % 3000),
  'PR' || lpad((((n - 1) / 80) + 1)::text, 2, '0'),
  'REAL-' || lpad((((n - 1) / 80) + 1)::text, 2, '0') || '-' || ((n + k) % 3 + 1),
  round((1 + (n % 400) / 100.0)::numeric, 2),
  round((40 + (n % 60))::numeric, 2),
  1, 3, 'ACTIVA', 'DOC-REAL', 'Docente Realista'
FROM generate_series(1, 2000) AS n, generate_series(0, 1) AS k;
COMMIT;

SELECT count(*) AS matriculas_sinteticas FROM matricula_institucional;
