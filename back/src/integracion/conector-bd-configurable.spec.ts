import {
  ErrorConectorInstitucional,
  MENSAJES_TABLA_2,
} from '../aplicacion/contratos/conector-bd-institucional';
import { Programa } from '../dominio/entidades/programa';
import {
  enlazarPrograma,
  fechaBogota,
  normalizar,
  traducirError,
  validarFila,
} from './conector-bd-configurable';
import { validarConfiguracionConector } from './configuracion-conector';

const HOY = '2026-11-17';
const sis = new Programa({
  idPrograma: 'SIS',
  nombre: 'Ingeniería de Sistemas',
});
const qui = new Programa({ idPrograma: 'QUI', nombre: 'Química' });
const musicaA = new Programa({
  idPrograma: 'MUS1',
  nombre: 'Licenciatura en Música',
});
const musicaB = new Programa({
  idPrograma: 'MUS2',
  nombre: 'Licenciatura en musica',
});
const PROGRAMAS = [sis, qui, musicaA, musicaB];

const filaValida = {
  id_estudiante: '2026001',
  nombre_estudiante: 'Ana Pérez Núñez',
  correo_estudiante: 'ana@ejemplo.invalid',
  fecha_nacimiento: '2004-05-17',
  programa_academico: 'SIS',
  codigo_asignatura: 'ISOF-101',
  calificacion_acumulada: '2.80',
  porcentaje_asistencia: '65.00',
};

describe('validarFila (rangos de la Tabla 2 del ER)', () => {
  it('acepta una fila válida y convierte los tipos', () => {
    const resultado = validarFila(filaValida, PROGRAMAS, HOY);
    expect(resultado).toMatchObject({
      id: '2026001',
      nombre: 'Ana Pérez Núñez',
      nota: 2.8,
      asistencia: 65,
      programa: sis,
    });
    expect('fechaNacimiento' in resultado && resultado.fechaNacimiento).toEqual(
      new Date(2004, 4, 17),
    );
  });

  it.each([
    [{ id_estudiante: '2026 001' }, 'identificacion'],
    [{ id_estudiante: '1234' }, 'identificacion'],
    [{ id_estudiante: 'a'.repeat(21) }, 'identificacion'],
    [{ nombre_estudiante: 'Pedro 3' }, 'identificacion'],
    [{ nombre_estudiante: 'A' }, 'identificacion'],
    [{ correo_estudiante: 'sin-arroba.ejemplo.invalid' }, 'correo'],
    [{ correo_estudiante: `${'a'.repeat(95)}@x.invalid` }, 'correo'],
    [{ fecha_nacimiento: '2030-01-01' }, 'fechaNacimiento'],
    [{ fecha_nacimiento: HOY }, 'fechaNacimiento'],
    [{ fecha_nacimiento: null }, 'fechaNacimiento'],
    [{ programa_academico: 'Arquitectura' }, 'programa'],
    [{ programa_academico: 'Licenciatura en Musica' }, 'programa'],
    [{ calificacion_acumulada: '5.50' }, 'calificacionAsistencia'],
    [{ calificacion_acumulada: '-0.10' }, 'calificacionAsistencia'],
    [{ porcentaje_asistencia: '120.00' }, 'calificacionAsistencia'],
    [{ porcentaje_asistencia: null }, 'calificacionAsistencia'],
  ])('%o → se omite por %s', (cambio, causa) => {
    expect(validarFila({ ...filaValida, ...cambio }, PROGRAMAS, HOY)).toEqual({
      causa,
    });
  });

  it('acepta los extremos 0.00–5.00 y 0.00–100.00', () => {
    for (const [nota, asistencia] of [
      ['0.00', '0.00'],
      ['5.00', '100.00'],
    ]) {
      expect(
        'causa' in
          validarFila(
            {
              ...filaValida,
              calificacion_acumulada: nota,
              porcentaje_asistencia: asistencia,
            },
            PROGRAMAS,
            HOY,
          ),
      ).toBe(false);
    }
  });

  it('acepta la fecha como Date (driver de PostgreSQL)', () => {
    expect(
      'causa' in
        validarFila(
          { ...filaValida, fecha_nacimiento: new Date(2004, 4, 17) },
          PROGRAMAS,
          HOY,
        ),
    ).toBe(false);
  });
});

describe('enlazarPrograma (respuesta 1 de Ivan)', () => {
  it('primero por idPrograma exacto', () => {
    expect(enlazarPrograma('QUI', PROGRAMAS)).toBe(qui);
  });

  it('luego por nombre normalizado (mayúsculas, tildes y espacios)', () => {
    expect(enlazarPrograma('  INGENIERIA   DE  SISTEMAS ', PROGRAMAS)).toBe(
      sis,
    );
    expect(enlazarPrograma('quimica', PROGRAMAS)).toBe(qui);
  });

  it('ninguno o varios por nombre: null', () => {
    expect(enlazarPrograma('Arquitectura', PROGRAMAS)).toBeNull();
    expect(enlazarPrograma('Licenciatura en Música', PROGRAMAS)).toBeNull();
  });

  it('normalizar quita tildes, mayúsculas y espacios sobrantes', () => {
    expect(normalizar('  Ingeniería   DE Sistemas ')).toBe(
      'ingenieria de sistemas',
    );
  });
});

describe('fechaBogota', () => {
  it('usa UTC-5: las 03:00 UTC son todavía el día anterior en Bogotá', () => {
    expect(fechaBogota(new Date('2026-11-18T03:00:00Z'))).toBe('2026-11-17');
    expect(fechaBogota(new Date('2026-11-18T05:00:00Z'))).toBe('2026-11-18');
  });
});

describe('traducirError (mensajes de la Tabla 2)', () => {
  it.each([
    [{ code: '28P01' }, MENSAJES_TABLA_2.credenciales],
    [{ driverError: { code: '42501' } }, MENSAJES_TABLA_2.credenciales],
    [{ driverError: { code: '42703' } }, MENSAJES_TABLA_2.estructura],
    [{ code: 'ECONNREFUSED' }, MENSAJES_TABLA_2.sinConexion],
    [
      { message: 'Connection terminated due to connection timeout' },
      MENSAJES_TABLA_2.sinConexion,
    ],
  ])('%o', (error, mensaje) => {
    const traducido = traducirError(error);
    expect(traducido).toBeInstanceOf(ErrorConectorInstitucional);
    expect(traducido.message).toBe(mensaje);
  });
});

describe('validarConfiguracionConector', () => {
  const mapeo = {
    id_estudiante: 'codigo',
    nombre_estudiante: 'nombre',
    correo_estudiante: 'correo',
    fecha_nacimiento: 'nacimiento',
    programa_academico: 'carrera',
    codigo_asignatura: 'materia',
    calificacion_acumulada: 'nota',
    porcentaje_asistencia: 'asistencia',
  };

  it('acepta un mapeo con otros nombres de columna', () => {
    expect(
      validarConfiguracionConector({
        origen: 'esquema.vista',
        mapeoCampos: mapeo,
      }).mapeoCampos.id_estudiante,
    ).toBe('codigo');
  });

  it('rechaza identificadores que podrían inyectar SQL y campos ajenos a la Tabla 2', () => {
    expect(() =>
      validarConfiguracionConector({
        origen: 'vista; DROP TABLE persona',
        mapeoCampos: { ...mapeo, nota: 'x' },
      }),
    ).toThrow(/origen[\s\S]*nota no es un campo de la Tabla 2/);
    expect(() =>
      validarConfiguracionConector({
        origen: 'vista',
        mapeoCampos: { ...mapeo, correo_estudiante: 'correo"--' },
      }),
    ).toThrow(/correo_estudiante debe ser un nombre de columna válido/);
  });
});
