-- Base institucional EMULADA (institucional_demo), fase B4. Manual 4.1.1.8:
-- se puebla con un CSV de datos ficticios y el conector la lee mediante un
-- usuario de solo lectura con permisos únicamente sobre una vista.
--
-- Lo ejecuta docker/postgres/cargar-institucional.mjs (npm run bd:institucional
-- desde back/) como detecta_user, dentro de una transacción. La tabla se
-- vacía y se recarga desde el CSV en cada ejecución: es la fuente de verdad
-- de la demostración (respuesta 12 de Ivan). No toca la base detecta.

\set ON_ERROR_STOP on
BEGIN;

-- Tabla del "cliente": las columnas de la Tabla 2 del ER más columnas que el
-- conector no usa (semestre, créditos, estado de matrícula, docente), para
-- evidenciar que el mapeo de campos selecciona solo lo necesario. Los tipos
-- admiten valores fuera de rango para que el conector los detecte.
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

-- Vista de solo lectura: columnas requeridas y solo matrículas activas.
CREATE OR REPLACE VIEW vista_estudiantes_matriculados AS
  SELECT id_estudiante, nombre_estudiante, correo_estudiante, fecha_nacimiento,
         programa_academico, codigo_asignatura, calificacion_acumulada,
         porcentaje_asistencia
  FROM matricula_institucional
  WHERE estado_matricula = 'ACTIVA';

-- Vista de prueba sin correo_estudiante: provoca "Estructura de datos no
-- reconocida: Faltan columnas requeridas en las tablas de origen."
CREATE OR REPLACE VIEW vista_estructura_incompleta AS
  SELECT id_estudiante, nombre_estudiante, fecha_nacimiento,
         programa_academico, codigo_asignatura, calificacion_acumulada,
         porcentaje_asistencia
  FROM matricula_institucional
  WHERE estado_matricula = 'ACTIVA';

-- Solo lectura: el lector solo puede hacer SELECT sobre las vistas, nunca
-- sobre la tabla (además, su sesión es read-only desde B0).
REVOKE ALL ON matricula_institucional FROM PUBLIC, institucional_lector;
REVOKE ALL ON vista_estudiantes_matriculados, vista_estructura_incompleta
  FROM PUBLIC, institucional_lector;
GRANT SELECT ON vista_estudiantes_matriculados, vista_estructura_incompleta
  TO institucional_lector;

TRUNCATE matricula_institucional;
COPY matricula_institucional FROM STDIN WITH (FORMAT csv, HEADER true);
