import { Curso } from '../../dominio/entidades/curso';
import { Docente } from '../../dominio/entidades/docente';
import { Estudiante } from '../../dominio/entidades/estudiante';
import type { Persona } from '../../dominio/entidades/persona';
import { Programa } from '../../dominio/entidades/programa';
import { RegistroAcademico } from '../../dominio/entidades/registro-academico';
import {
  ErrorConectorInstitucional,
  MENSAJES_TABLA_2,
  omisionesVacias,
  type ConectorBDInstitucional,
  type OmisionesLectura,
} from '../contratos/conector-bd-institucional';
import {
  RecursoOcupadoError,
  type RepositoriosTransaccionales,
  type UnidadTrabajo,
} from '../contratos/unidad-trabajo';
import {
  mensajesSincronizacion,
  ServicioSincronizacion,
} from './servicio-sincronizacion';

const AHORA = new Date('2026-11-17T15:00:00Z');
const sis = new Programa({ idPrograma: 'SIS', nombre: 'Sistemas' });

function curso(id: string): Curso {
  return new Curso({
    idCurso: id,
    nombre: id,
    periodo: '2026-2',
    ultimaSincronizacion: null,
    estudiantes: [],
  });
}

function estudiante(id: string, nombre = `Nombre ${id}`): Estudiante {
  return new Estudiante({
    id,
    nombre,
    correo: `${id}@ejemplo.invalid`,
    contrasenaHash: '!SIN_ACTIVAR',
    fechaNacimiento: new Date(2003, 0, 1),
    programa: sis,
  });
}

function registro(est: Estudiante, c: Curso, nota = 3): RegistroAcademico {
  return new RegistroAcademico({
    idRegistro: `tmp-${est.id}-${c.idCurso}-${Math.random()}`,
    nota,
    porcentajeAsistencia: 80,
    estudiante: est,
    curso: c,
  });
}

/** Repositorios en memoria y una unidad de trabajo que solo los entrega. */
function crearEscenario(cursos: Curso[]) {
  const personas = new Map<string, Persona>();
  const registros = new Map<string, RegistroAcademico>();
  const cursosPorId = new Map(cursos.map((c) => [c.idCurso, c]));
  const repositorios = {
    personas: {
      buscarPorId: (id: string) => Promise.resolve(personas.get(id) ?? null),
      buscarPorCorreo: (correo: string) =>
        Promise.resolve(
          [...personas.values()].find((p) => p.correo === correo) ?? null,
        ),
      guardar: (p: Persona) => {
        personas.set(p.id, p);
        return Promise.resolve();
      },
    },
    registros: {
      listarPorCurso: (idCurso: string) =>
        Promise.resolve(
          [...registros.values()].filter((r) => r.curso.idCurso === idCurso),
        ),
      guardar: (r: RegistroAcademico) => {
        registros.set(r.idRegistro, r);
        return Promise.resolve();
      },
    },
    cursos: {
      buscarPorId: (id: string) => Promise.resolve(cursosPorId.get(id) ?? null),
      guardar: () => Promise.resolve(),
      listar: () => Promise.resolve([...cursosPorId.values()]),
    },
  } as unknown as RepositoriosTransaccionales;
  const unidad: UnidadTrabajo & { ocupado: boolean } = {
    ocupado: false,
    ejecutar(trabajo) {
      if (this.ocupado) {
        return Promise.reject(new RecursoOcupadoError('ocupado'));
      }
      return trabajo(repositorios);
    },
  };
  return { personas, registros, repositorios, unidad, cursosPorId };
}

function conector(
  lecturas: Record<string, RegistroAcademico[]>,
  omisiones: Record<string, Partial<OmisionesLectura>> = {},
): ConectorBDInstitucional & { conectar: jest.Mock } {
  let ultima = omisionesVacias();
  return {
    conectar: jest.fn().mockResolvedValue(true),
    obtenerEstudiantes: () => Promise.resolve([]),
    obtenerRegistros: (idCurso: string) => {
      ultima = { ...omisionesVacias(), ...omisiones[idCurso] };
      return Promise.resolve(lecturas[idCurso] ?? []);
    },
    omisionesUltimaLectura: () => ({ ...ultima }),
  };
}

function servicio(
  c: ConectorBDInstitucional,
  escenario: ReturnType<typeof crearEscenario>,
): ServicioSincronizacion {
  return new ServicioSincronizacion(
    c,
    escenario.unidad,
    escenario.repositorios.cursos,
    () => AHORA,
  );
}

describe('ServicioSincronizacion', () => {
  it('crea estudiantes nuevos y registros, marca el curso y produce los mensajes del ER', async () => {
    const isof = curso('ISOF-101');
    const esc = crearEscenario([isof]);
    const a = estudiante('2026001');
    const b = estudiante('2026002');
    const srv = servicio(
      conector(
        { 'ISOF-101': [registro(a, isof), registro(b, isof)] },
        { 'ISOF-101': { calificacionAsistencia: 2, programa: 1 } },
      ),
      esc,
    );

    await expect(srv.sincronizarCurso('ISOF-101')).resolves.toBe(2);
    expect(esc.personas.size).toBe(2);
    expect(esc.registros.size).toBe(2);
    expect(isof.ultimaSincronizacion).toEqual(AHORA);
    const resultado = srv.obtenerUltimoResultado();
    expect(resultado?.omitidos).toBe(3);
    expect(resultado?.mensajes).toEqual([
      MENSAJES_TABLA_2.conexionEstablecida,
      'Sincronización completada: Se han actualizado 2 registros académicos en la persistencia del sistema.',
      'Advertencia de sincronización: Se omitieron 2 registros debido a datos de calificación o asistencia fuera de rango.',
      'Advertencia de sincronización: Se omitieron 1 registros por datos de identificación, correo, fecha de nacimiento o programa no válidos o no configurados.',
    ]);
  });

  it('es idempotente: reutiliza el id del registro existente', async () => {
    const isof = curso('ISOF-101');
    const esc = crearEscenario([isof]);
    const a = estudiante('2026001');
    const srv = servicio(conector({ 'ISOF-101': [registro(a, isof)] }), esc);
    await srv.sincronizarCurso('ISOF-101');
    const [idOriginal] = esc.registros.keys();
    await srv.sincronizarCurso('ISOF-101');
    expect([...esc.registros.keys()]).toEqual([idOriginal]);
  });

  it('un estudiante con datos distintos en dos cursos omite TODAS sus filas (respuesta 13)', async () => {
    const isof = curso('ISOF-101');
    const fis = curso('FIS-301');
    const esc = crearEscenario([isof, fis]);
    const srv = servicio(
      conector({
        'ISOF-101': [registro(estudiante('2026002', 'Nombre Uno'), isof)],
        'FIS-301': [
          registro(estudiante('2026002', 'Nombre Distinto'), fis),
          registro(estudiante('2026114'), fis),
        ],
      }),
      esc,
    );
    await expect(srv.sincronizarTodo()).resolves.toBe(1);
    expect(esc.personas.has('2026002')).toBe(false);
    expect(srv.obtenerUltimoResultado()?.desglose).toEqual({
      ...omisionesVacias(),
      datosInconsistentesEstudiante: 2,
    });
  });

  it('omite la fila si el correo pertenece a otra persona o si el id no es de un estudiante', async () => {
    const isof = curso('ISOF-101');
    const esc = crearEscenario([isof]);
    const docente = new Docente({
      id: 'D1',
      nombre: 'Docente',
      correo: '2026010@ejemplo.invalid',
      contrasenaHash: 'h',
      cursos: [],
    });
    esc.personas.set('D1', docente);
    const conflicto = estudiante('2026010'); // mismo correo que el docente
    const noEstudiante = new Estudiante({
      id: 'D1',
      nombre: 'Otro',
      correo: 'otro@ejemplo.invalid',
      contrasenaHash: 'h',
      fechaNacimiento: new Date(2003, 0, 1),
      programa: sis,
    });
    const srv = servicio(
      conector({
        'ISOF-101': [registro(conflicto, isof), registro(noEstudiante, isof)],
      }),
      esc,
    );
    await expect(srv.sincronizarCurso('ISOF-101')).resolves.toBe(0);
    expect(srv.obtenerUltimoResultado()?.desglose).toEqual({
      ...omisionesVacias(),
      correo: 1,
      identificacion: 1,
    });
  });

  it('un error de conexión se propaga antes de escribir nada', async () => {
    const isof = curso('ISOF-101');
    const esc = crearEscenario([isof]);
    const c = conector({ 'ISOF-101': [registro(estudiante('2026001'), isof)] });
    c.conectar.mockRejectedValue(
      new ErrorConectorInstitucional(MENSAJES_TABLA_2.sinConexion),
    );
    await expect(servicio(c, esc).sincronizarCurso('ISOF-101')).rejects.toThrow(
      MENSAJES_TABLA_2.sinConexion,
    );
    expect(esc.personas.size).toBe(0);
    expect(esc.registros.size).toBe(0);
  });

  it('si ya hay una sincronización en curso, falla sin esperar', async () => {
    const isof = curso('ISOF-101');
    const esc = crearEscenario([isof]);
    esc.unidad.ocupado = true;
    await expect(
      servicio(conector({}), esc).sincronizarTodo(),
    ).rejects.toBeInstanceOf(RecursoOcupadoError);
  });
});

describe('mensajesSincronizacion', () => {
  it('sin omisiones: solo conexión y sincronización completada', () => {
    expect(mensajesSincronizacion(5, omisionesVacias())).toEqual([
      MENSAJES_TABLA_2.conexionEstablecida,
      'Sincronización completada: Se han actualizado 5 registros académicos en la persistencia del sistema.',
    ]);
  });
});
