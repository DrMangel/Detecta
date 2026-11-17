import type { DataSource } from 'typeorm';
import {
  casoDeAlerta,
  crearEscenario,
  crearRepositorios,
  type Escenario,
  type Repositorios,
} from './escenario';
import {
  abrirFuenteAplicacion,
  migrarBasePruebas,
  TABLAS,
  vaciarBasePruebas,
} from './soporte';

/*
 * Restricciones de la BD (D7, ER 3.5.5, Tabla 2) y permisos del usuario de
 * la aplicación (ER 3.7 c). Todo se ejecuta con detecta_app.
 */

let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;

beforeAll(async () => {
  await migrarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
});

afterAll(async () => {
  await fuente.destroy();
});

beforeEach(async () => {
  await vaciarBasePruebas();
  esc = await crearEscenario(repos);
});

const INSERTAR_CASO = `
  INSERT INTO caso_riesgo (id_caso, fecha_creacion, motivo, estado, justificacion,
    confidencialidad, consentimiento_confirmado, id_estudiante, id_origen)
  VALUES ($1, now(), 'motivo', 'PENDIENTE', '', false, false, 'E1', $2)`;

describe('D7 en la base de datos', () => {
  it('D7: un caso sin origen se rechaza (NOT NULL)', async () => {
    await expect(fuente.query(INSERTAR_CASO, ['X1', null])).rejects.toThrow(
      /null value in column "id_origen"/,
    );
  });

  it('D7: dos casos con el mismo origen se rechazan (UNIQUE)', async () => {
    const { alerta } = await casoDeAlerta(repos, esc.d1, esc.r1);
    await expect(
      fuente.query(INSERTAR_CASO, ['X2', alerta.idOrigen]),
    ).rejects.toThrow(/uq_caso_origen/);
  });

  it('D7: caso_riesgo no tiene columna de docente', async () => {
    const columnas: { column_name: string }[] = await fuente.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'caso_riesgo'`,
    );
    expect(columnas.map((c) => c.column_name)).not.toContain('id_docente');
  });

  it('un caso con motivo vacío se rechaza', async () => {
    const { alerta } = await casoDeAlerta(repos, esc.d1, esc.r1);
    await expect(
      fuente.query(INSERTAR_CASO.replace("'motivo'", "'   '"), [
        'X3',
        alerta.idOrigen,
      ]),
    ).rejects.toThrow(/caso_riesgo_motivo_check/);
  });
});

describe('Restricciones de subtipo, integridad y rangos', () => {
  it('una alerta sin registro académico se rechaza (ER 3.5.5)', async () => {
    await expect(
      fuente.query(
        `INSERT INTO origen_riesgo (id_origen, tipo, fecha, estado, nivel_riesgo, descripcion, id_docente)
         VALUES ('O1', 'ALERTA', now(), 'PENDIENTE', 'ALTO', 'x', 'D1')`,
      ),
    ).rejects.toThrow(/ck_origen_subtipo/);
  });

  it('una solicitud con columnas de alerta se rechaza', async () => {
    await expect(
      fuente.query(
        `INSERT INTO origen_riesgo (id_origen, tipo, fecha, estado, tipo_apoyo, motivo,
           disponibilidad, id_estudiante, id_docente)
         VALUES ('O2', 'SOLICITUD', now(), 'PENDIENTE', 'ACADEMICA', 'm', 'd', 'E1', 'D1')`,
      ),
    ).rejects.toThrow(/ck_origen_subtipo/);
  });

  it('un estudiante sin fecha de nacimiento se rechaza (D5)', async () => {
    await expect(
      fuente.query(
        `INSERT INTO persona (id, rol, nombre, correo, contrasena_hash, id_programa)
         VALUES ('E9', 'ESTUDIANTE', 'x', 'e9@x.co', 'h', 'P1')`,
      ),
    ).rejects.toThrow(/ck_persona_subtipo/);
  });

  it('el correo es único (ER 3.5.5)', async () => {
    await expect(
      fuente.query(
        `INSERT INTO persona (id, rol, nombre, correo, contrasena_hash)
         VALUES ('D9', 'DOCENTE', 'x', 'd1@ejemplo.edu.co', 'h')`,
      ),
    ).rejects.toThrow(/uq_persona_correo/);
  });

  it('una nota fuera de 0 a 5 se rechaza (ER Tabla 2)', async () => {
    await expect(
      fuente.query(
        `INSERT INTO registro_academico (id_registro, nota, porcentaje_asistencia, id_estudiante, id_curso)
         VALUES ('R9', 5.5, 50, 'E2', 'C0')`,
      ),
    ).rejects.toThrow(/registro_academico_nota_check/);
  });

  it('un programa solo puede tener un jefe (dirige, 1 a 1)', async () => {
    await expect(
      fuente.query(
        `INSERT INTO persona (id, rol, nombre, correo, contrasena_hash, id_programa_dirigido)
         VALUES ('J9', 'JEFE_DEPARTAMENTO', 'x', 'j9@x.co', 'h', 'P1')`,
      ),
    ).rejects.toThrow(/uq_persona_programa_dirigido/);
  });
});

describe('Usuario de la aplicación sin DELETE (ER 3.7 c)', () => {
  it('detecta_app tiene SELECT, INSERT y UPDATE, y no DELETE ni TRUNCATE, en todas las tablas', async () => {
    const filas: {
      tabla: string;
      select: boolean;
      insert: boolean;
      update: boolean;
      delete: boolean;
      truncate: boolean;
    }[] = await fuente.query(
      `SELECT t AS tabla,
              has_table_privilege('detecta_app', t, 'SELECT') AS "select",
              has_table_privilege('detecta_app', t, 'INSERT') AS "insert",
              has_table_privilege('detecta_app', t, 'UPDATE') AS "update",
              has_table_privilege('detecta_app', t, 'DELETE') AS "delete",
              has_table_privilege('detecta_app', t, 'TRUNCATE') AS "truncate"
       FROM unnest($1::text[]) AS t`,
      [TABLAS],
    );
    expect(filas).toHaveLength(TABLAS.length);
    for (const fila of filas) {
      expect(fila).toEqual({
        tabla: fila.tabla,
        select: true,
        insert: true,
        update: true,
        delete: false,
        truncate: false,
      });
    }
  });

  it('un DELETE real con la conexión de la aplicación falla con permission denied', async () => {
    await casoDeAlerta(repos, esc.d1, esc.r1);
    await expect(fuente.query('DELETE FROM caso_riesgo')).rejects.toThrow(
      'permission denied for table caso_riesgo',
    );
    const [{ total }] = await fuente.query(
      'SELECT count(*)::int AS total FROM caso_riesgo',
    );
    expect(total).toBe(1);
  });
});
