import assert from 'node:assert/strict';
import test from 'node:test';
import { prepararCarga } from './cargar-institucional.mjs';

test('mantiene institucional_demo como destino implícito del entorno actual', () => {
  const carga = prepararCarga([], { BD_INSTITUCIONAL_NOMBRE: 'institucional_demo' });
  assert.equal(carga.base, 'institucional_demo');
  assert.equal(carga.csv, './institucional_demo.csv');
});

test('permite la carga de la Tabla 25 solo en institucional_entrega', () => {
  const carga = prepararCarga(['--base', 'institucional_entrega'], {});
  assert.equal(carga.base, 'institucional_entrega');
  assert.equal(carga.csv, './institucional_entrega.csv');
});

test('la variante de columnas ficticias no reemplaza la carga principal', () => {
  const carga = prepararCarga(
    ['--base', 'institucional_entrega', '--variante', 'alternativa'],
    {},
  );
  assert.equal(carga.sql, './institucional_entrega-alternativa.sql');
  assert.equal(carga.tabla, 'matricula_institucional_alternativa');
});

test('rechaza toda base que no sea institucional_demo o institucional_entrega', () => {
  for (const base of [
    'detecta_entrega',
    'detecta',
    'detecta_pruebas',
    'institucional_carga',
  ]) {
    assert.throws(
      () => prepararCarga(['--base', base], {}),
      /solo se permiten institucional_demo e institucional_entrega/,
    );
  }
});

test('no permite la variante alternativa sobre institucional_demo', () => {
  assert.throws(
    () => prepararCarga(['--base', 'institucional_demo', '--variante', 'alternativa'], {}),
    /solo se permite en institucional_entrega/,
  );
});
