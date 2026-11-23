import assert from 'node:assert/strict';
import test from 'node:test';
import { identidadesDesdeEntorno, ocultar } from './preparar-remoto.mjs';

const HOST = 'ep-prueba-123456.us-east-2.aws.neon.tech';
const ENTORNO = {
  NEON_CADENA_DUENO: `postgresql://neondb_owner:cl%40ve-dueno@${HOST}/neondb?sslmode=require`,
  BD_DETECTA_HOST: HOST,
  BD_DETECTA_USUARIO: 'detecta_app',
  BD_DETECTA_CONTRASENA: 'clave-app',
  BD_MIGRADOR_USUARIO: 'detecta_migrador',
  BD_MIGRADOR_CONTRASENA: 'clave-migrador',
  BD_INSTITUCIONAL_USUARIO: 'institucional_lector',
  BD_INSTITUCIONAL_CONTRASENA: 'clave-lector',
};

test('obtiene el dueño de la cadena de Neon, decodificando la clave', () => {
  const identidades = identidadesDesdeEntorno(ENTORNO);
  assert.equal(identidades.host, HOST);
  assert.equal(identidades.baseDueno, 'neondb');
  assert.deepEqual(identidades.dueno, { usuario: 'neondb_owner', clave: 'cl@ve-dueno' });
  assert.deepEqual(identidades.lector, { usuario: 'institucional_lector', clave: 'clave-lector' });
});

test('rechaza usuarios distintos de los roles del modelo, sin mostrar claves', () => {
  assert.throws(
    () => identidadesDesdeEntorno({ ...ENTORNO, BD_DETECTA_USUARIO: 'neondb_owner' }),
    (error) =>
      error.message === 'El usuario de app en demo/.env.remoto debe ser detecta_app.' &&
      !error.message.includes('clave'),
  );
});

test('oculta todos los secretos de un mensaje de error', () => {
  const texto = `ERROR: fallo en ${HOST} con clave-app y clave-lector`;
  assert.equal(
    ocultar(texto, ['clave-app', 'clave-lector', HOST, undefined, '']),
    'ERROR: fallo en <oculto> con <oculto> y <oculto>',
  );
});
