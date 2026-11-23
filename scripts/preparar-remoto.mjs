// Prepara las bases REMOTAS de la demostración en Neon (F6, decisión J6).
//
// Uso: lo llama scripts/preparar-remoto.ps1, que antes valida
// demo/.env.remoto y que detecta-postgres esté activo.
//
// Mismo modelo de F5a (demo/README.md): roles detecta_app (sin DELETE ni
// TRUNCATE, ER 3.7 c), detecta_migrador (dueño del esquema) e
// institucional_lector (solo lectura sobre las vistas), y las bases
// detecta_entrega e institucional_entrega (J5).
//
// psql 18 corre en un contenedor TEMPORAL (`docker run --rm`) de la misma
// imagen que detecta-postgres: esa imagen no trae certificados raíz y
// verify-full necesita uno. Se montan, en solo lectura, las raíces de Mozilla
// que incluye Node (tls.rootCertificates). Así no se instala nada, no se
// modifica detecta-postgres y no se toca ninguna base local. Las credenciales
// viajan como variables de entorno del proceso, nunca como argumentos, y no
// se imprimen (ER 3.6.2).

import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { prepararCarga } from '../docker/postgres/cargar-institucional.mjs';

const IMAGEN_PSQL = 'postgres:18';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const BACK = join(RAIZ, 'back');
const ARCHIVO_ENTORNO = '../demo/.env.remoto';
const ROLES = {
  app: 'detecta_app',
  migrador: 'detecta_migrador',
  lector: 'institucional_lector',
};
const BASES = ['detecta_entrega', 'institucional_entrega'];
// Decisión 3 de F5a: respaldo fuera del repositorio, nunca impreso.
const ARCHIVO_ENLACES = join(homedir(), 'detecta-entrega', 'enlaces-activacion-remoto.txt');

/** Credenciales por identidad a partir de demo/.env.remoto. */
export function identidadesDesdeEntorno(entorno) {
  const dueno = new URL(entorno.NEON_CADENA_DUENO.trim());
  const usuarios = {
    app: entorno.BD_DETECTA_USUARIO?.trim(),
    migrador: entorno.BD_MIGRADOR_USUARIO?.trim(),
    lector: entorno.BD_INSTITUCIONAL_USUARIO?.trim(),
  };
  for (const [clave, rol] of Object.entries(ROLES)) {
    if (usuarios[clave] !== rol) {
      throw new Error(`El usuario de ${clave} en demo/.env.remoto debe ser ${rol}.`);
    }
  }
  return {
    host: entorno.BD_DETECTA_HOST.trim(),
    baseDueno: decodeURIComponent(dueno.pathname.slice(1)) || 'neondb',
    dueno: {
      usuario: decodeURIComponent(dueno.username),
      clave: decodeURIComponent(dueno.password),
    },
    app: { usuario: ROLES.app, clave: entorno.BD_DETECTA_CONTRASENA },
    migrador: { usuario: ROLES.migrador, clave: entorno.BD_MIGRADOR_CONTRASENA },
    lector: { usuario: ROLES.lector, clave: entorno.BD_INSTITUCIONAL_CONTRASENA },
  };
}

/** Reemplaza cualquier secreto que aparezca en un texto antes de mostrarlo. */
export function ocultar(texto, secretos) {
  return secretos
    .filter((secreto) => typeof secreto === 'string' && secreto.length >= 4)
    .reduce((acumulado, secreto) => acumulado.split(secreto).join('<oculto>'), texto);
}

/** Carpeta temporal con las raíces de Node; se borra al terminar. */
function prepararRaices() {
  const carpeta = mkdtempSync(join(tmpdir(), 'detecta-f6-raices-'));
  writeFileSync(join(carpeta, 'raices.pem'), `${rootCertificates.join('\n')}\n`);
  return carpeta;
}

function crearPsql(identidades, carpetaRaices) {
  const secretos = [
    identidades.dueno.clave,
    identidades.app.clave,
    identidades.migrador.clave,
    identidades.lector.clave,
    identidades.host,
  ];
  const permitidas = new Set([identidades.baseDueno, ...BASES]);
  return function psql(quien, base, sql, { esperarFallo = false } = {}) {
    if (!permitidas.has(base)) {
      throw new Error(`Base fuera de la lista permitida: ${base}`);
    }
    const entorno = {
      ...process.env,
      PGHOST: identidades.host,
      PGPORT: '5432',
      PGUSER: identidades[quien].usuario,
      PGPASSWORD: identidades[quien].clave,
      PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: '/raices/raices.pem',
      CLAVE_APP: identidades.app.clave,
      CLAVE_MIGRADOR: identidades.migrador.clave,
      CLAVE_LECTOR: identidades.lector.clave,
    };
    const variables = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE', 'PGSSLROOTCERT'];
    if (quien === 'dueno') {
      variables.push('CLAVE_APP', 'CLAVE_MIGRADOR', 'CLAVE_LECTOR');
    }
    const resultado = spawnSync(
      'docker',
      [
        'run', '--rm', '-i', '-v', `${carpetaRaices}:/raices:ro`,
        ...variables.flatMap((nombre) => ['-e', nombre]), IMAGEN_PSQL,
        'psql', '-d', base, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=terse', '-qtA', '-f', '-',
      ],
      { input: sql, env: entorno, encoding: 'utf8' },
    );
    const salida = ocultar(resultado.stdout ?? '', secretos).trim();
    const error = ocultar(resultado.stderr ?? '', secretos).trim();
    if (esperarFallo) {
      return { fallo: resultado.status !== 0, error };
    }
    if (resultado.status !== 0) {
      throw new Error(`Falló psql como ${identidades[quien].usuario} en ${base}: ${error}`);
    }
    return salida;
  };
}

// ALTER ROLE sin NOSUPERUSER ni NOREPLICATION: en Neon el dueño no es
// superusuario y no puede declarar esos atributos; CREATE ROLE ya los deja
// en falso y la verificación los comprueba.
function sqlRoles() {
  const lineas = ['\\getenv clave_app CLAVE_APP', '\\getenv clave_migrador CLAVE_MIGRADOR', '\\getenv clave_lector CLAVE_LECTOR'];
  for (const [clave, rol] of Object.entries(ROLES)) {
    lineas.push(
      `SELECT format('CREATE ROLE ${rol} LOGIN PASSWORD %L', :'clave_${clave}') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${rol}')\\gexec`,
      `SELECT format('ALTER ROLE ${rol} WITH LOGIN NOCREATEDB NOCREATEROLE PASSWORD %L', :'clave_${clave}')\\gexec`,
    );
  }
  lineas.push(
    'ALTER ROLE institucional_lector SET default_transaction_read_only = on;',
    // PostgreSQL 16+: para crear una base con OWNER detecta_migrador, el dueño
    // de Neon debe poder asumir ese rol.
    'GRANT detecta_migrador TO CURRENT_USER;',
  );
  return `${lineas.join('\n')}\n`;
}

// Igual que New-BasesEntrega en scripts/preparar-demo.ps1.
const SQL_BASES = `
SELECT 'CREATE DATABASE detecta_entrega OWNER detecta_migrador' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'detecta_entrega')\\gexec
SELECT 'CREATE DATABASE institucional_entrega' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'institucional_entrega')\\gexec
REVOKE ALL ON DATABASE detecta_entrega FROM PUBLIC;
GRANT CONNECT ON DATABASE detecta_entrega TO detecta_app, detecta_migrador;
REVOKE ALL ON DATABASE institucional_entrega FROM PUBLIC;
GRANT CONNECT ON DATABASE institucional_entrega TO institucional_lector;
`;

function ejecutarBack(descripcion, argumentos, opciones = {}) {
  const resultado = spawnSync(process.execPath, [`--env-file=${ARCHIVO_ENTORNO}`, ...argumentos], {
    cwd: BACK,
    stdio: opciones.stdio ?? 'inherit',
  });
  if (resultado.status !== 0) {
    throw new Error(`Falló ${descripcion}.`);
  }
}

function compilarBack() {
  const resultado = spawnSync('npm run build', { cwd: BACK, stdio: 'inherit', shell: true });
  if (resultado.status !== 0) {
    throw new Error('Falló la compilación del backend.');
  }
}

function sqlInstitucional() {
  const destino = prepararCarga(['--base', 'institucional_entrega'], {});
  const leer = (nombre) =>
    readFileSync(fileURLToPath(new URL(nombre, new URL('../docker/postgres/', import.meta.url))), 'utf8');
  const csv = leer(destino.csv).replace(/\r\n/g, '\n');
  return `${leer(destino.sql)}${csv.trimEnd()}\n\\.\nCOMMIT;\nSELECT count(*) FROM ${destino.tabla};\n`;
}

function crearDatosIniciales() {
  mkdirSync(join(homedir(), 'detecta-entrega'), { recursive: true });
  const descriptor = openSync(ARCHIVO_ENLACES, 'w');
  try {
    ejecutarBack('la creación de los datos iniciales', ['dist/comandos/datos-iniciales.js', '../demo/datos-iniciales.ejemplo.json'], {
      stdio: ['ignore', descriptor, 'inherit'],
    });
  } finally {
    closeSync(descriptor);
  }
}

function preparar(psql, identidades) {
  const version = psql('dueno', identidades.baseDueno, "SELECT current_setting('server_version_num')::int / 10000;\n");
  if (version !== '18') {
    throw new Error(`Se esperaba PostgreSQL 18 y el servidor es ${version}.`);
  }
  console.log('Servidor remoto: PostgreSQL 18.');
  psql('dueno', identidades.baseDueno, sqlRoles());
  console.log('Roles listos: detecta_app, detecta_migrador, institucional_lector.');
  psql('dueno', identidades.baseDueno, SQL_BASES);
  psql('migrador', 'detecta_entrega', 'GRANT USAGE ON SCHEMA public TO detecta_app;\n');
  psql('dueno', 'institucional_entrega', 'GRANT USAGE ON SCHEMA public TO institucional_lector;\n');
  console.log('Bases listas: detecta_entrega e institucional_entrega.');
  compilarBack();
  ejecutarBack('las migraciones de detecta_entrega', ['dist/persistencia/ejecutar-migraciones.js', 'detecta_entrega', 'migrar']);
  const filas = psql('dueno', 'institucional_entrega', sqlInstitucional());
  console.log(`Tabla 25 cargada en institucional_entrega: ${filas.split('\n').at(-1)} filas.`);
  crearDatosIniciales();
  console.log(`Datos iniciales creados. Enlaces de respaldo (no mostrar ni versionar): ${ARCHIVO_ENLACES}`);
}

const SQL_ATRIBUTOS = `SELECT rolname || ': superusuario=' || rolsuper || ', createdb=' || rolcreatedb || ', createrole=' || rolcreaterole || ', replicacion=' || rolreplication || ', bypassrls=' || rolbypassrls || ', login=' || rolcanlogin || coalesce(', config=' || array_to_string(rolconfig, ';'), '')
FROM pg_roles WHERE rolname IN ('detecta_app', 'detecta_migrador', 'institucional_lector') ORDER BY rolname;
`;

const SQL_PRIVILEGIOS = `SELECT p.priv || ': ' || count(*) FILTER (WHERE has_table_privilege('detecta_app', c.oid, p.priv)) || ' de ' || count(*) || ' tablas'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) WITH ORDINALITY AS p(priv, orden)
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'migraciones_typeorm'
GROUP BY p.priv, p.orden ORDER BY p.orden;
SELECT 'sin UPDATE: ' || coalesce(string_agg(c.relname, ', ' ORDER BY c.relname), 'ninguna')
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'migraciones_typeorm' AND NOT has_table_privilege('detecta_app', c.oid, 'UPDATE');
SELECT 'detecta_app sobre migraciones_typeorm: ' || has_table_privilege('detecta_app', 'migraciones_typeorm', 'SELECT');
SELECT 'migraciones aplicadas: ' || count(*) FROM migraciones_typeorm;
`;

const SQL_CONTEOS = `SELECT 'programas: ' || (SELECT count(*) FROM programa) || ', cuentas: ' || (SELECT count(*) FROM persona WHERE rol <> 'ESTUDIANTE') || ', cursos: ' || (SELECT count(*) FROM curso);
`;

const SQL_LECTOR = `SHOW default_transaction_read_only;
SELECT 'filas visibles en vista_estudiantes_matriculados: ' || count(*) FROM vista_estudiantes_matriculados;
`;

function rechazo(psql, quien, base, sql) {
  const { fallo, error } = psql(quien, base, sql, { esperarFallo: true });
  const denegado = fallo && /permission denied|permiso denegado/i.test(error);
  return denegado ? 'denegado (correcto)' : `NO denegado: ${error || 'la sentencia se ejecutó'}`;
}

function verificar(psql, identidades) {
  console.log('\nVerificación de roles y permisos:');
  console.log(psql('dueno', identidades.baseDueno, SQL_ATRIBUTOS));
  console.log(psql('migrador', 'detecta_entrega', SQL_PRIVILEGIOS));
  console.log(psql('app', 'detecta_entrega', SQL_CONTEOS));
  // Pruebas negativas dentro de una transacción revertida: nunca borran nada.
  console.log(`DELETE como detecta_app: ${rechazo(psql, 'app', 'detecta_entrega', 'BEGIN;\nDELETE FROM evento_caso WHERE false;\nROLLBACK;\n')}`);
  console.log(`TRUNCATE como detecta_app: ${rechazo(psql, 'app', 'detecta_entrega', 'BEGIN;\nTRUNCATE persona;\nROLLBACK;\n')}`);
  console.log(`UPDATE de evento_caso como detecta_app: ${rechazo(psql, 'app', 'detecta_entrega', 'BEGIN;\nUPDATE evento_caso SET id_evento = id_evento WHERE false;\nROLLBACK;\n')}`);
  const [soloLectura, filasVista] = psql('lector', 'institucional_entrega', SQL_LECTOR).split('\n');
  console.log(`institucional_lector: default_transaction_read_only=${soloLectura}; ${filasVista}`);
  console.log(`SELECT de la tabla base como institucional_lector: ${rechazo(psql, 'lector', 'institucional_entrega', 'SELECT 1 FROM matricula_institucional LIMIT 1;\n')}`);
  console.log(`detecta_app en institucional_entrega: ${psql('app', 'detecta_entrega', "SELECT 'CONNECT=' || has_database_privilege('detecta_app', 'institucional_entrega', 'CONNECT');\n")}`);
  console.log(`institucional_lector en detecta_entrega: ${psql('lector', 'institucional_entrega', "SELECT 'CONNECT=' || has_database_privilege('institucional_lector', 'detecta_entrega', 'CONNECT');\n")}`);
}

if (import.meta.main) {
  const carpetaRaices = prepararRaices();
  try {
    const entorno = parseEnv(readFileSync(join(RAIZ, 'demo', '.env.remoto'), 'utf8'));
    const identidades = identidadesDesdeEntorno(entorno);
    const psql = crearPsql(identidades, carpetaRaices);
    if (!process.argv.includes('--solo-verificar')) {
      preparar(psql, identidades);
    }
    verificar(psql, identidades);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Error inesperado.');
    process.exitCode = 1;
  } finally {
    rmSync(carpetaRaices, { recursive: true, force: true });
  }
}
