import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { leerCsv } from '../docker/postgres/datos-entrega.mjs';
import { cuentasEvaluador, lineaCuenta, tokenDeSalida } from './preactivar-remoto.mjs';

test('extrae el token del enlace que imprime datos-iniciales --enlace', () => {
  const salida = [
    'Enlace de activación para detectasoportetecnico+docente@gmail.com (una sola vez):',
    '  https://detecta-web.onrender.com/activar#token=Ab3_x-Yz09',
    '',
  ].join('\n');
  assert.equal(tokenDeSalida(salida), 'Ab3_x-Yz09');
});

test('falla sin mostrar la salida si no hay enlace', () => {
  assert.throws(
    () => tokenDeSalida('No existe una cuenta con el correo x@y.z'),
    { message: 'La salida de datos-iniciales no trae un enlace de activación.' },
  );
});

// Datos de la demostración (decisión de Ivan): las cuentas del evaluador salen
// de los mismos datos que cargan las bases, sin correos escritos en el script.
test('las cinco cuentas del evaluador salen de los datos de la demostración', () => {
  const datos = JSON.parse(readFileSync(new URL('../demo/datos-iniciales.ejemplo.json', import.meta.url), 'utf8'));
  const filas = leerCsv(new URL('../docker/postgres/institucional_entrega.csv', import.meta.url));
  const esperadas = [
    ...['DOCENTE', 'JEFE_DEPARTAMENTO', 'PSICOLOGO'].map((rol) => {
      const usuario = datos.usuarios.find((u) => u.rol === rol);
      return { rol, nombre: usuario.nombre, correo: usuario.correo };
    }),
    ...[
      ['2026001', 'ESTUDIANTE (adulto, 2026001)'],
      ['2026005', 'ESTUDIANTE (menor de edad, 2026005)'],
    ].map(([id, rol]) => {
      const fila = filas.find((f) => f.id_estudiante === id);
      return { rol, nombre: fila.nombre_estudiante, correo: fila.correo_estudiante };
    }),
  ];
  assert.deepEqual(cuentasEvaluador(), esperadas);
});

test('cada línea de cuentas-evaluador.txt lleva rol, nombre, correo y contraseña', () => {
  const cuenta = { rol: 'DOCENTE', nombre: 'Nombre Apellido', correo: 'cuenta@ejemplo.invalid' };
  assert.equal(lineaCuenta(cuenta, 'clave'), 'DOCENTE | Nombre Apellido | cuenta@ejemplo.invalid | clave');
});

test('el script no tiene correos escritos a mano', () => {
  const fuente = readFileSync(new URL('./preactivar-remoto.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /[\w.%+-]+@[\w-]+\.[\w.-]+/);
});
