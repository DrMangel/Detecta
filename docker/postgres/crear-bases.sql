-- Aprovisionamiento de las bases y usuarios de DETECTA (fase B0).
--
-- Se puede ejecutar varias veces sin efectos duplicados: no borra datos ni recrea
-- nada que ya exista. Se ejecuta como superusuario (detecta_user) dentro del
-- contenedor mediante docker/postgres/crear-bases.mjs (npm run bd:crear desde back/).
-- Las contraseñas llegan como variables de psql (:clave_app, :clave_lector);
-- nunca se escriben en este archivo (ER 3.6.2).
--
-- Permisos de B0: solo conexión y uso del esquema. Los privilegios sobre tablas
-- se otorgan en B2 (detecta_app sin permiso de eliminación, ER 3.7 c) y en B4
-- (institucional_lector, solo lectura sobre la vista institucional).

\set ON_ERROR_STOP on

-- 1. Base que simula la BD institucional (docs/00-linea-base.md §5)
SELECT 'CREATE DATABASE institucional_demo OWNER detecta_user'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'institucional_demo')\gexec

-- 2. Usuario de la aplicación para la base detecta
SELECT format('CREATE ROLE detecta_app LOGIN PASSWORD %L', :'clave_app')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'detecta_app')\gexec
SELECT format(
  'ALTER ROLE detecta_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'clave_app')\gexec

-- 3. Usuario de solo lectura para la base institucional (línea base §4)
SELECT format('CREATE ROLE institucional_lector LOGIN PASSWORD %L', :'clave_lector')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'institucional_lector')\gexec
SELECT format(
  'ALTER ROLE institucional_lector WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'clave_lector')\gexec
ALTER ROLE institucional_lector SET default_transaction_read_only = on;

-- 4. Cada usuario solo puede conectarse a su base
REVOKE ALL ON DATABASE detecta FROM PUBLIC;
REVOKE ALL ON DATABASE institucional_demo FROM PUBLIC;
GRANT CONNECT ON DATABASE detecta TO detecta_app;
GRANT CONNECT ON DATABASE institucional_demo TO institucional_lector;

\connect detecta
GRANT USAGE ON SCHEMA public TO detecta_app;

\connect institucional_demo
GRANT USAGE ON SCHEMA public TO institucional_lector;
