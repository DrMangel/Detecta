import assert from 'node:assert/strict';
import test from 'node:test';
import { tokenDeSalida } from './preactivar-remoto.mjs';

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
