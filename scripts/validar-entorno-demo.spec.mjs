import assert from 'node:assert/strict';
import test from 'node:test';
import { revisarEntornoDemo } from './validar-entorno-demo.mjs';

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
