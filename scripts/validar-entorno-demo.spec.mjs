import assert from 'node:assert/strict';
import test from 'node:test';
import {
  revisarEntornoDemo,
  revisarEntornoRemoto,
} from './validar-entorno-demo.mjs';

const EJEMPLO = [
  'PUERTO=3000',
  'URL_FRONTEND=http://localhost:5173',
  'BD_DETECTA_NOMBRE=detecta_entrega',
  'BD_DETECTA_CONTRASENA=',
  'BD_INSTITUCIONAL_NOMBRE=institucional_entrega',
  'CORREO_RECHAZAR_EJEMPLO_INVALID=true',
  'CORREO_DESTINO_PERMITIDO=detectasoportetecnico+*@gmail.com',
].join('\n');
const DEMO = `${EJEMPLO.replace('BD_DETECTA_CONTRASENA=', 'BD_DETECTA_CONTRASENA=secreta')}\n`;

test('acepta un demo/.env completo y aislado', () => {
  assert.deepEqual(revisarEntornoDemo(DEMO, EJEMPLO, {}), []);
});

test('rechaza que demo/.env apunte a una base que no es de entrega', () => {
  const errores = revisarEntornoDemo(
    DEMO.replace('=detecta_entrega', '=detecta'),
    EJEMPLO,
    {},
  );
  assert.deepEqual(errores, ['BD_DETECTA_NOMBRE debe ser detecta_entrega.']);
});

test('exige el bloqueo de @ejemplo.invalid y la lista permitida de alias', () => {
  const errores = revisarEntornoDemo(
    DEMO.replace('INVALID=true', 'INVALID=false').replace(
      'CORREO_DESTINO_PERMITIDO=detectasoportetecnico+*@gmail.com',
      'CORREO_DESTINO_PERMITIDO=',
    ),
    EJEMPLO,
    {},
  );
  assert.equal(errores.length, 2);
});

test('rechaza claves ausentes, porque se tomarían de back/.env', () => {
  const errores = revisarEntornoDemo(
    DEMO.replace('BD_INSTITUCIONAL_NOMBRE=institucional_entrega\n', ''),
    EJEMPLO,
    {},
  );
  assert.ok(errores.includes('Falta BD_INSTITUCIONAL_NOMBRE en demo/.env.'));
});

test('rechaza variables de la sesión que taparían demo/.env, sin mostrar su valor', () => {
  const errores = revisarEntornoDemo(DEMO, EJEMPLO, {
    BD_DETECTA_CONTRASENA: 'otra-clave',
    PUERTO: '3000',
  });
  assert.equal(errores.length, 1);
  assert.match(errores[0], /^BD_DETECTA_CONTRASENA está definida en la sesión/);
  assert.doesNotMatch(errores[0], /otra-clave|secreta/);
});

// F6: demo/.env.remoto (herramientas locales contra Neon).
const HOST = 'ep-prueba-123456.us-east-2.aws.neon.tech';
const EJEMPLO_REMOTO = [
  'PGSSLMODE=verify-full',
  'BD_DETECTA_HOST=',
  'BD_DETECTA_NOMBRE=detecta_entrega',
  'BD_INSTITUCIONAL_HOST=',
  'BD_INSTITUCIONAL_NOMBRE=institucional_entrega',
  'NEON_CADENA_DUENO=',
  'URL_FRONTEND=https://detecta-web.onrender.com',
  'CORREO_MODO=desactivado',
  'CORREO_RECHAZAR_EJEMPLO_INVALID=true',
  'CORREO_DESTINO_PERMITIDO=detectasoportetecnico+*@gmail.com',
].join('\n');
const REMOTO = EJEMPLO_REMOTO.replace('BD_DETECTA_HOST=', `BD_DETECTA_HOST=${HOST}`)
  .replace('BD_INSTITUCIONAL_HOST=', `BD_INSTITUCIONAL_HOST=${HOST}`)
  .replace('NEON_CADENA_DUENO=', `NEON_CADENA_DUENO=postgresql://neondb_owner:clave-secreta@${HOST}/neondb?sslmode=require`);

test('acepta un demo/.env.remoto completo con conexión directa', () => {
  assert.deepEqual(revisarEntornoRemoto(REMOTO, EJEMPLO_REMOTO, {}), []);
});

test('rechaza el host del pooler y localhost, sin mostrar la cadena', () => {
  const errores = revisarEntornoRemoto(
    REMOTO.replace(`BD_DETECTA_HOST=${HOST}`, 'BD_DETECTA_HOST=localhost').replace(
      `@${HOST}/`,
      '@ep-prueba-123456-pooler.us-east-2.aws.neon.tech/',
    ),
    EJEMPLO_REMOTO,
    {},
  );
  assert.equal(errores.length, 2);
  for (const error of errores) {
    assert.doesNotMatch(error, /clave-secreta|ep-prueba/);
  }
});

test('exige TLS verificado, el front público y el correo desactivado', () => {
  const errores = revisarEntornoRemoto(
    REMOTO.replace('verify-full', 'require')
      .replace('https://detecta-web.onrender.com', 'http://localhost:5173')
      .replace('CORREO_MODO=desactivado', 'CORREO_MODO=smtp'),
    EJEMPLO_REMOTO,
    {},
  );
  assert.equal(errores.length, 3);
});

test('exige que la cadena del dueño apunte al mismo proyecto', () => {
  const errores = revisarEntornoRemoto(
    REMOTO.replace(`@${HOST}/`, '@ep-otro-999.us-east-2.aws.neon.tech/'),
    EJEMPLO_REMOTO,
    {},
  );
  assert.deepEqual(errores, [
    'NEON_CADENA_DUENO debe usar el mismo host directo que BD_DETECTA_HOST.',
  ]);
});

test('nombra demo/.env.remoto en las claves ausentes', () => {
  const errores = revisarEntornoRemoto(
    REMOTO.replace('PGSSLMODE=verify-full\n', ''),
    EJEMPLO_REMOTO,
    {},
  );
  assert.ok(errores.includes('Falta PGSSLMODE en demo/.env.remoto.'));
});
