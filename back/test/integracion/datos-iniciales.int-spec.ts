import type { DataSource } from 'typeorm';
import {
  cargarDatosIniciales,
  emitirEnlaceParaCorreo,
  validarDatosIniciales,
  type DependenciasDatosIniciales,
} from '../../src/comandos/datos-iniciales';
import { ServicioAutenticacion } from '../../src/aplicacion/servicios/servicio-autenticacion';
import { Docente } from '../../src/dominio/entidades/docente';
import { JefeDepartamento } from '../../src/dominio/entidades/jefe-departamento';
import { RepositorioPersistenteCredenciales } from '../../src/persistencia/repositorio-persistente-credenciales';
import { crearRepositorios, type Repositorios } from './escenario';
import {
  abrirFuenteAplicacion,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';

/*
 * Script de datos iniciales (B3: programas y usuarios) contra detecta_pruebas.
 */

let fuente: DataSource;
let repos: Repositorios;
let salida: string[];
let dependencias: DependenciasDatosIniciales;

const DATOS = validarDatosIniciales({
  programas: [{ idPrograma: 'SIS', nombre: 'Sistemas' }],
  usuarios: [
    {
      rol: 'JEFE_DEPARTAMENTO',
      id: 'J1',
      nombre: 'Jefa',
      correo: 'jefa@x.co',
      idPrograma: 'SIS',
    },
    { rol: 'PSICOLOGO', id: 'PS1', nombre: 'Psicólogo', correo: 'ps@x.co' },
    { rol: 'DOCENTE', id: 'D1', nombre: 'Docente', correo: 'doc@x.co' },
  ],
});

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
  salida = [];
  const autenticacion = new ServicioAutenticacion(
    repos.personas,
    new RepositorioPersistenteCredenciales(fuente),
    { enviar: () => Promise.resolve(false) },
    {
      bcryptCosto: 10,
      activacionDuracionMin: 30,
      urlFrontend: 'http://localhost:5173',
    },
    () => new Date(),
  );
  dependencias = {
    personas: repos.personas,
    programas: repos.programas,
    cursos: repos.cursos,
    autenticacion,
    imprimir: (linea) => salida.push(linea),
  };
});

const enlaces = () =>
  salida.filter((linea) => linea.includes('/activar#token='));

describe('datos:iniciales', () => {
  it('crea programas y cuentas sin activar e imprime un enlace por cuenta nueva', async () => {
    await expect(cargarDatosIniciales(DATOS, dependencias)).resolves.toEqual({
      creados: 3,
      omitidos: 0,
    });
    expect(enlaces()).toHaveLength(3);
    const jefe = await repos.personas.buscarPorCorreo('jefa@x.co');
    expect(jefe).toBeInstanceOf(JefeDepartamento);
    expect((jefe as JefeDepartamento).programa.idPrograma).toBe('SIS');
    const hashes: { contrasena_hash: string }[] = await fuente.query(
      'SELECT DISTINCT contrasena_hash FROM persona',
    );
    expect(hashes).toEqual([{ contrasena_hash: '!SIN_ACTIVAR' }]);
    // Se guardó solo el hash de cada token, no el token impreso.
    const [{ total }] = await fuente.query(
      'SELECT count(*)::int AS total FROM token_activacion',
    );
    expect(total).toBe(3);
    const tokenImpreso = /#token=(.+)$/.exec(enlaces()[0] ?? '')?.[1] ?? '';
    const filas = await fuente.query('SELECT * FROM token_activacion');
    expect(JSON.stringify(filas)).not.toContain(tokenImpreso);
  });

  it('es idempotente por correo: la segunda vez no crea, no modifica ni imprime enlaces', async () => {
    await cargarDatosIniciales(DATOS, dependencias);
    await fuente.query(
      "UPDATE persona SET nombre = 'Cambiado' WHERE id = 'PS1'",
    );
    salida = [];
    await expect(cargarDatosIniciales(DATOS, dependencias)).resolves.toEqual({
      creados: 0,
      omitidos: 3,
    });
    expect(enlaces()).toHaveLength(0);
    expect((await repos.personas.buscarPorId('PS1'))?.nombre).toBe('Cambiado');
  });

  it('el jefe exige que su programa exista', async () => {
    const datos = validarDatosIniciales({
      programas: [],
      usuarios: [
        {
          rol: 'JEFE_DEPARTAMENTO',
          id: 'J9',
          nombre: 'Jefe',
          correo: 'j9@x.co',
          idPrograma: 'NO',
        },
      ],
    });
    await expect(cargarDatosIniciales(datos, dependencias)).rejects.toThrow(
      'El programa NO del jefe j9@x.co no existe',
    );
  });

  it('un programa no puede recibir un segundo jefe (D17 pendiente)', async () => {
    await cargarDatosIniciales(DATOS, dependencias);
    const otro = validarDatosIniciales({
      programas: [],
      usuarios: [
        {
          rol: 'JEFE_DEPARTAMENTO',
          id: 'J2',
          nombre: 'Otro',
          correo: 'j2@x.co',
          idPrograma: 'SIS',
        },
      ],
    });
    await expect(cargarDatosIniciales(otro, dependencias)).rejects.toThrow(
      /D17/,
    );
  });

  it('rechaza estudiantes y datos inválidos al validar el archivo', () => {
    expect(() =>
      validarDatosIniciales({
        programas: [],
        usuarios: [
          { rol: 'ESTUDIANTE', id: 'E1', nombre: 'Est', correo: 'e@x.co' },
        ],
      }),
    ).toThrow(/los estudiantes llegan por sincronización/);
    expect(() =>
      validarDatosIniciales({
        programas: [],
        usuarios: [
          {
            rol: 'DOCENTE',
            id: 'D1',
            nombre: 'A',
            correo: 'no-es-correo',
            idPrograma: 'X',
          },
        ],
      }),
    ).toThrow(/correo válido[\s\S]*solo aplica al JEFE_DEPARTAMENTO|nombre/);
    expect(() => validarDatosIniciales({})).toThrow(/"programas" y "usuarios"/);
  });

  it('--enlace emite un enlace nuevo para una cuenta existente y anula el anterior', async () => {
    await cargarDatosIniciales(DATOS, dependencias);
    salida = [];
    await emitirEnlaceParaCorreo('doc@x.co', dependencias);
    expect(enlaces()).toHaveLength(1);
    const vigentes: { total: number }[] = await fuente.query(
      `SELECT count(*)::int AS total FROM token_activacion
       WHERE id_persona = 'D1' AND anulado_en IS NULL`,
    );
    expect(vigentes[0]?.total).toBe(1);
    await expect(
      emitirEnlaceParaCorreo('nadie@x.co', dependencias),
    ).rejects.toThrow(/No existe una cuenta/);
  });
});

describe('datos:iniciales: cursos y asignación docente–curso (B4)', () => {
  const conCursos = (cursos: unknown[]) =>
    validarDatosIniciales({
      programas: [{ idPrograma: 'SIS', nombre: 'Sistemas' }],
      usuarios: [
        { rol: 'DOCENTE', id: 'D1', nombre: 'Docente', correo: 'doc@x.co' },
        { rol: 'DOCENTE', id: 'D2', nombre: 'Otro', correo: 'otro@x.co' },
      ],
      cursos,
    });
  const ISOF = {
    idCurso: 'ISOF-101',
    nombre: 'Ingeniería de Software I',
    periodo: '2026-2',
    idDocente: 'D1',
  };

  it('crea el curso y lo asigna al docente (dicta)', async () => {
    await cargarDatosIniciales(conCursos([ISOF]), dependencias);
    const curso = await repos.cursos.buscarPorId('ISOF-101');
    expect(curso?.periodo).toBe('2026-2');
    expect(curso?.ultimaSincronizacion).toBeNull();
    const docente = (await repos.personas.buscarPorId('D1')) as Docente;
    expect(docente.cursos.map((c) => c.idCurso)).toEqual(['ISOF-101']);
    expect(salida).toContain('Curso ISOF-101: creado y asignado a D1.');
  });

  it('es idempotente por idCurso', async () => {
    await cargarDatosIniciales(conCursos([ISOF]), dependencias);
    salida = [];
    await cargarDatosIniciales(conCursos([ISOF]), dependencias);
    expect(salida).toContain('Curso ISOF-101: ya existe, sin cambios.');
    const [{ total }] = await fuente.query(
      'SELECT count(*)::int AS total FROM curso',
    );
    expect(total).toBe(1);
  });

  it('reasignar un curso a otro docente falla con mensaje explicativo', async () => {
    await cargarDatosIniciales(conCursos([ISOF]), dependencias);
    await expect(
      cargarDatosIniciales(
        conCursos([{ ...ISOF, idDocente: 'D2' }]),
        dependencias,
      ),
    ).rejects.toThrow(
      'El curso ISOF-101 ya está asignado al docente D1: la reasignación de un curso a otro docente está pendiente de decisión',
    );
  });

  it('el docente del curso debe existir', async () => {
    await expect(
      cargarDatosIniciales(
        conCursos([{ ...ISOF, idDocente: 'NADIE' }]),
        dependencias,
      ),
    ).rejects.toThrow('El docente NADIE del curso ISOF-101 no existe');
  });

  it('agregar cursos no altera el hash de un docente ya activado', async () => {
    await cargarDatosIniciales(conCursos([]), dependencias);
    await fuente.query(
      "UPDATE persona SET contrasena_hash = '$2b$12$hash-docente-activado' WHERE id = 'D1'",
    );
    await cargarDatosIniciales(conCursos([ISOF]), dependencias);
    const [fila] = await fuente.query(
      "SELECT contrasena_hash FROM persona WHERE id = 'D1'",
    );
    expect(fila.contrasena_hash).toBe('$2b$12$hash-docente-activado');
  });

  it('valida el formato de idCurso y rechaza idCurso repetidos', () => {
    expect(() =>
      conCursos([{ ...ISOF, idCurso: 'IS OF' }, ISOF, ISOF]),
    ).toThrow(/alfanumérico[\s\S]*idCurso repetido/);
  });
});
