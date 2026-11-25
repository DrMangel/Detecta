// Coherencia de los datos de la demostración (decisión de Ivan): alias de
// soporte derivados del nombre, únicos y sin dígitos, y los mismos conteos y
// casos límite que documenta la línea base (80 filas, 78 ids, 60 en ISOF-101,
// 5 menores; sincronización completa con 67 válidas y 11 omitidas).
//
// La réplica de las reglas del conector es aproximada y solo sirve para
// detectar un cambio accidental de las anomalías; la comprobación real es
// sincronizar sobre las bases de la demostración.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseEnv } from 'node:util';
import { aliasDeNombre, leerCsv } from './datos-entrega.mjs';

const ruta = (relativa) => new URL(relativa, import.meta.url);
const filas = leerCsv(ruta('./institucional_entrega.csv'));
const alternativa = leerCsv(ruta('./institucional_entrega-alternativa.csv'));
const datos = JSON.parse(readFileSync(ruta('../../demo/datos-iniciales.ejemplo.json'), 'utf8'));
const { CORREO_DESTINO_PERMITIDO: patron } = parseEnv(
  readFileSync(ruta('../../demo/.env.example'), 'utf8'),
);
const [prefijo, dominio] = patron.split('*');
// Fecha de referencia de los conteos documentados (los menores dependen de ella).
const REFERENCIA = '2026-11-25';

const porId = Map.groupBy(filas, (fila) => fila.id_estudiante);
const sufijo = (correo) => correo.slice(prefijo.length, correo.length - dominio.length);
const edad = (nacimiento) => {
  const [a, m, d] = nacimiento.split('-').map(Number);
  const [ra, rm, rd] = REFERENCIA.split('-').map(Number);
  return ra - a - (rm < m || (rm === m && rd < d) ? 1 : 0);
};

test('la regla de alias usa nombre y primer apellido, sin tildes ni dígitos', () => {
  assert.equal(aliasDeNombre('Nicolás Ortiz Gómez'), 'nicolas.ortiz');
  assert.equal(aliasDeNombre('Germán Andrés Pineda Castro'), 'german.pineda');
  assert.equal(aliasDeNombre('Pablo Londoño Castro'), 'pablo.londono');
  assert.equal(aliasDeNombre('Pedro 3'), 'pedro');
});

test('conteos documentados: 80 filas, 78 ids, 60 en ISOF-101 y 5 menores', () => {
  assert.equal(filas.length, 80);
  assert.equal(porId.size, 78);
  const isof = filas.filter((f) => f.codigo_asignatura === 'ISOF-101' && f.estado_matricula === 'ACTIVA');
  assert.equal(isof.length, 60);
  const menores = new Set(filas.filter((f) => edad(f.fecha_nacimiento) < 18).map((f) => f.id_estudiante));
  assert.equal(menores.size, 5);
});

test('cada estudiante tiene un único alias de soporte, derivado de su nombre y sin dígitos', () => {
  const vistos = new Map();
  for (const [id, propias] of porId) {
    const correos = new Set(propias.map((f) => f.correo_estudiante));
    assert.equal(correos.size, 1, `${id}: más de un correo`);
    const [correo] = correos;
    assert.ok(correo.startsWith(prefijo) && correo.endsWith(dominio), `${id}: fuera del patrón permitido`);
    assert.equal(correo, correo.toLowerCase(), `${id}: mayúsculas en el correo`);
    assert.ok(correo.length <= 100, `${id}: correo de más de 100 caracteres`);
    const alias = sufijo(correo);
    assert.doesNotMatch(alias, /\d/, `${id}: alias con dígitos`);
    assert.equal(alias, aliasDeNombre(propias[0].nombre_estudiante), `${id}: alias no derivado del nombre`);
    assert.ok(!vistos.has(alias), `${id}: alias repetido con ${vistos.get(alias)}`);
    vistos.set(alias, id);
  }
  for (const usuario of datos.usuarios) {
    const alias = sufijo(usuario.correo);
    assert.equal(alias, aliasDeNombre(usuario.nombre), `${usuario.id}: alias no derivado del nombre`);
    assert.ok(!vistos.has(alias), `${usuario.id}: alias repetido con ${vistos.get(alias)}`);
    vistos.set(alias, usuario.id);
  }
});

test('el docente del CSV es la cuenta de datos-iniciales que dicta los cursos', () => {
  const docente = datos.usuarios.find((u) => u.rol === 'DOCENTE');
  for (const fila of filas) {
    assert.equal(fila.id_docente, docente.id);
    assert.equal(fila.nombre_docente, docente.nombre);
  }
});

test('la variante alternativa tiene los mismos valores fila a fila', () => {
  assert.equal(alternativa.length, filas.length);
  filas.forEach((fila, i) => assert.deepEqual(Object.values(alternativa[i]), Object.values(fila)));
});

test('sincronización completa: 67 válidas y 11 omitidas con el desglose documentado', () => {
  const cursos = new Set(datos.cursos.map((c) => c.idCurso));
  const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const programa = (v) =>
    v.length >= 3 && v.length <= 100 &&
    datos.programas.some((p) => p.idPrograma === v || normalizar(p.nombre) === normalizar(v));
  const leidas = filas.filter((f) => f.estado_matricula === 'ACTIVA' && cursos.has(f.codigo_asignatura));
  const causa = (f) => {
    if (!/^[A-Za-z0-9]{5,20}$/.test(f.id_estudiante)) return 'identificacion';
    if (!/^\p{L}+(?: \p{L}+)*$/u.test(f.nombre_estudiante.replace(/\s+/g, ' '))) return 'identificacion';
    if (f.fecha_nacimiento >= REFERENCIA) return 'fechaNacimiento';
    if (!programa(f.programa_academico)) return 'programa';
    const nota = Number(f.calificacion_acumulada);
    const asistencia = Number(f.porcentaje_asistencia);
    if (!(nota >= 0 && nota <= 5 && asistencia >= 0 && asistencia <= 100)) return 'calificacionAsistencia';
    const personales = new Set(porId.get(f.id_estudiante).map((g) => `${g.nombre_estudiante}|${g.fecha_nacimiento}`));
    return personales.size > 1 ? 'datosInconsistentesEstudiante' : null;
  };
  const desglose = {};
  for (const f of leidas) {
    const c = causa(f);
    if (c) desglose[c] = (desglose[c] ?? 0) + 1;
  }
  assert.equal(leidas.length, 78);
  assert.equal(leidas.filter((f) => causa(f) === null).length, 67);
  assert.deepEqual(desglose, {
    calificacionAsistencia: 3,
    identificacion: 3,
    fechaNacimiento: 1,
    programa: 2,
    datosInconsistentesEstudiante: 2,
  });
});
