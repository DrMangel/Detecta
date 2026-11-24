import { HttpException, Logger } from '@nestjs/common';
import {
  BloqueoAgotadoError,
  type OpcionesUnidadTrabajo,
  type RepositoriosTransaccionales,
  type UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import type { ServicioNotificacion } from '../aplicacion/servicios/servicio-notificacion';
import type { CasoRiesgo } from '../dominio/entidades/caso-riesgo';
import { Curso } from '../dominio/entidades/curso';
import { Docente } from '../dominio/entidades/docente';
import { EstadoCaso } from '../dominio/entidades/estado-caso';
import { Estudiante } from '../dominio/entidades/estudiante';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import { NivelRiesgo } from '../dominio/entidades/nivel-riesgo';
import type { Persona } from '../dominio/entidades/persona';
import type { PlanNivelacion } from '../dominio/entidades/plan-nivelacion';
import { Programa } from '../dominio/entidades/programa';
import { Psicologo } from '../dominio/entidades/psicologo';
import { RegistroAcademico } from '../dominio/entidades/registro-academico';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import {
  ControladorCasosRiesgo,
  MENSAJES_CASOS,
} from './controlador-casos-riesgo';
import { MENSAJE_BLOQUEO_AGOTADO } from './respuestas';
import type { OrigenSolicitudDto } from './respuestas-casos';
import { MENSAJE_SOLICITUD_NO_VALIDA } from './validacion-entrada';

const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
const base = (id: string) => ({
  id,
  nombre: `Nombre ${id}`,
  correo: `${id.toLowerCase()}@ejemplo.edu.co`,
  contrasenaHash: 'h',
});
const ana = new Estudiante({
  ...base('E1'),
  fechaNacimiento: new Date(2000, 0, 1),
  programa,
});
const curso = new Curso({
  idCurso: 'C1',
  nombre: 'Cálculo',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [ana],
});
const docente = new Docente({ ...base('D1'), cursos: [curso] });
const jefe = new JefeDepartamento({ ...base('J1'), programa });
const psicologo = new Psicologo({ ...base('PS1'), citas: [] });
const registro = new RegistroAcademico({
  idRegistro: 'R1',
  nota: 2,
  porcentajeAsistencia: 60,
  estudiante: ana,
  curso,
});

function casoAcademico(): CasoRiesgo {
  return ana
    .solicitarAcompanamiento(
      RutaAtencion.ACADEMICA,
      'Motivo reservado',
      'Lunes',
    )
    .generarCasoRiesgo();
}

function casoAlerta(): CasoRiesgo {
  return docente
    .emitirAlerta(registro, NivelRiesgo.ALTO, 'Inasistencias')
    .generarCasoRiesgo();
}

function planDe(caso: CasoRiesgo): PlanNivelacion {
  return jefe.estructurarPlanNivelacion(
    caso,
    [curso],
    'Tutor Uno',
    'T-01',
    'Martes y jueves',
  );
}

function preparar(
  caso: CasoRiesgo | null,
  planes: readonly PlanNivelacion[] = [],
) {
  const repos = {
    casos: {
      buscarParaPrograma: jest.fn(async () => caso),
      listarPendientesPorPrograma: jest.fn(async () => (caso ? [caso] : [])),
      listarRutaAcademicaPorPrograma: jest.fn(async () => (caso ? [caso] : [])),
      guardar: jest.fn(async () => undefined),
    },
    planes: { listar: jest.fn(async () => [...planes]) },
    personas: {
      buscarJefePorPrograma: jest.fn(
        async () => jefe as JefeDepartamento | null,
      ),
      listarPorRol: jest.fn(async () => [psicologo]),
    },
    registros: { listar: jest.fn(async () => [registro]) },
  };
  const opciones: (OpcionesUnidadTrabajo | undefined)[] = [];
  const unidad: UnidadTrabajo = {
    ejecutar: (trabajo, opcion) => {
      opciones.push(opcion);
      return trabajo(repos as unknown as RepositoriosTransaccionales);
    },
  };
  const correo = { notificarCasoRemitido: jest.fn(async () => undefined) };
  const controlador = new ControladorCasosRiesgo(
    new ControlAcceso(),
    repos.casos as never,
    repos.registros as never,
    repos.planes as never,
    unidad,
    correo as unknown as ServicioNotificacion,
  );
  return { controlador, repos, correo, opciones, unidad };
}

async function errorDe(
  promesa: Promise<unknown>,
): Promise<{ estado: number; mensaje: string }> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse() as { message?: string } | string;
      return {
        estado: error.getStatus(),
        mensaje: typeof cuerpo === 'string' ? cuerpo : (cuerpo.message ?? ''),
      };
    }
    throw error;
  }
  throw new Error('se esperaba un error HTTP');
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('ControladorCasosRiesgo: permisos', () => {
  it.each(
    [ana, docente, psicologo].map(
      (p) => [p.obtenerRol(), p] as [string, Persona],
    ),
  )('%s recibe 403 en las cuatro operaciones', async (_rol, persona) => {
    const { controlador } = preparar(casoAlerta());
    for (const promesa of [
      controlador.listarCasosPendientes(persona),
      controlador.listarCasosRutaAcademica(persona),
      controlador.consultarCaso(persona, 'X'),
      controlador.canalizarCaso(persona, 'X', { ruta: 'ACADEMICA' }),
    ]) {
      expect((await errorDe(promesa)).estado).toBe(403);
    }
  });
});

describe('ControladorCasosRiesgo.canalizarCaso (sd_CUD04)', () => {
  it('ruta psicológica: canaliza con bloqueo del caso, notifica a los psicólogos y responde «Caso remitido a psicología»', async () => {
    const caso = casoAlerta();
    const { controlador, repos, correo, opciones } = preparar(caso);
    const respuesta = await controlador.canalizarCaso(jefe, caso.idCaso, {
      ruta: 'PSICOLOGICA',
    });
    expect(opciones).toEqual([{ bloqueos: [`caso:${caso.idCaso}`] }]);
    expect(repos.casos.buscarParaPrograma).toHaveBeenCalledWith(
      caso.idCaso,
      'P1',
    );
    expect(caso.ruta).toBe(RutaAtencion.PSICOLOGICA);
    expect(repos.casos.guardar).toHaveBeenCalledWith(caso);
    expect(correo.notificarCasoRemitido).toHaveBeenCalledWith(caso, [
      psicologo,
    ]);
    expect(respuesta.mensaje).toBe(MENSAJES_CASOS.remitidoPsicologia);
  });

  it('ruta académica: EN_NIVELACION, sin correo, «Caso canalizado a la ruta académica»', async () => {
    const caso = casoAcademico();
    const { controlador, correo } = preparar(caso);
    const respuesta = await controlador.canalizarCaso(jefe, caso.idCaso, {
      ruta: 'ACADEMICA',
    });
    expect(caso.estado).toBe(EstadoCaso.EN_NIVELACION);
    expect(correo.notificarCasoRemitido).not.toHaveBeenCalled();
    expect(respuesta.mensaje).toBe(MENSAJES_CASOS.canalizadoAcademica);
  });

  it('ya canalizado: 409 «El caso ya fue canalizado»', async () => {
    const caso = casoAlerta();
    caso.canalizar(RutaAtencion.ACADEMICA);
    const { controlador, repos } = preparar(caso);
    expect(
      await errorDe(
        controlador.canalizarCaso(jefe, caso.idCaso, { ruta: 'PSICOLOGICA' }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJES_CASOS.yaCanalizado });
    expect(repos.casos.guardar).not.toHaveBeenCalled();
  });

  it('caso no visible (otro programa, psicosocial o inexistente): 403', async () => {
    const { controlador } = preparar(null);
    expect(
      (
        await errorDe(
          controlador.canalizarCaso(jefe, 'X', { ruta: 'ACADEMICA' }),
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await errorDe(
          controlador.canalizarCaso(jefe, 'x'.repeat(37), {
            ruta: 'ACADEMICA',
          }),
        )
      ).estado,
    ).toBe(403);
  });

  it('programa sin jefe: 409 con el texto aprobado (requisito de B6)', async () => {
    const caso = casoAlerta();
    const { controlador, repos } = preparar(caso);
    repos.personas.buscarJefePorPrograma.mockResolvedValue(null);
    expect(
      await errorDe(
        controlador.canalizarCaso(jefe, caso.idCaso, { ruta: 'ACADEMICA' }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJES_CASOS.sinJefe });
  });

  it.each([[{}], [{ ruta: 'OTRA' }], [{ ruta: 'ACADEMICA', extra: 1 }], [[]]])(
    'cuerpo inválido %j: 400',
    async (cuerpo) => {
      const { controlador } = preparar(casoAlerta());
      expect(
        await errorDe(controlador.canalizarCaso(jefe, 'X', cuerpo)),
      ).toEqual({
        estado: 400,
        mensaje: MENSAJE_SOLICITUD_NO_VALIDA,
      });
    },
  );

  it('bloqueo vencido: 409 con el texto nuevo; error de persistencia: 503 de sd_CUD04', async () => {
    const caso = casoAlerta();
    const { controlador, unidad } = preparar(caso);
    unidad.ejecutar = () => Promise.reject(new BloqueoAgotadoError());
    expect(
      await errorDe(
        controlador.canalizarCaso(jefe, caso.idCaso, { ruta: 'ACADEMICA' }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJE_BLOQUEO_AGOTADO });
    unidad.ejecutar = () => Promise.reject(new Error('conexión perdida'));
    expect(
      await errorDe(
        controlador.canalizarCaso(jefe, caso.idCaso, { ruta: 'ACADEMICA' }),
      ),
    ).toEqual({ estado: 503, mensaje: MENSAJES_CASOS.errorCanalizacion });
  });
});

describe('ControladorCasosRiesgo: lecturas con la visibilidad aplicada (D18)', () => {
  it('bandeja: la solicitud académica muestra motivo y disponibilidad al Jefe', async () => {
    const caso = casoAcademico();
    const { controlador } = preparar(caso);
    const [dto] = await controlador.listarCasosPendientes(jefe);
    expect(dto?.origen).toMatchObject({
      tipo: 'SOLICITUD',
      motivo: 'Motivo reservado',
      disponibilidad: 'Lunes',
    });
  });

  it('detalle de una académica canalizada a psicología: solo el estado, sin motivo ni disponibilidad', async () => {
    const caso = casoAcademico();
    caso.canalizar(RutaAtencion.PSICOLOGICA);
    const { controlador } = preparar(caso);
    const detalle = await controlador.consultarCaso(jefe, caso.idCaso);
    const origen = detalle.caso.origen as OrigenSolicitudDto;
    expect(origen.motivo).toBeUndefined();
    expect(origen.disponibilidad).toBeUndefined();
    expect(detalle.caso.ruta).toBe('PSICOLOGICA');
    expect(JSON.stringify(detalle)).not.toContain('Motivo reservado');
  });

  it('detalle: antecedentes académicos del estudiante; nunca expediente ni justificación', async () => {
    const caso = casoAlerta();
    const { controlador, repos } = preparar(caso);
    const detalle = await controlador.consultarCaso(jefe, caso.idCaso);
    expect(repos.registros.listar).toHaveBeenCalledWith(
      new Map([['idEstudiante', 'E1']]),
    );
    expect(detalle.antecedentes[0]).toMatchObject({
      idRegistro: 'R1',
      nota: 2,
    });
    expect(Object.keys(detalle.caso)).not.toEqual(
      expect.arrayContaining(['citas']),
    );
    expect(detalle.caso).not.toHaveProperty('justificacion');
    expect(detalle.caso.origen).toMatchObject({
      tipo: 'ALERTA',
      descripcion: 'Inasistencias',
    });
  });

  it('detalle no visible: 403', async () => {
    const { controlador } = preparar(null);
    expect((await errorDe(controlador.consultarCaso(jefe, 'X'))).estado).toBe(
      403,
    );
  });
});

describe('ControladorCasosRiesgo: ruta académica y sus planes (F5b, D38)', () => {
  it('GET /casos/ruta-academica: casos del programa con la misma forma que la bandeja', async () => {
    const caso = casoAlerta();
    caso.canalizar(RutaAtencion.ACADEMICA);
    const { controlador, repos } = preparar(caso);
    const lista = await controlador.listarCasosRutaAcademica(jefe);
    const pendientes = await controlador.listarCasosPendientes(jefe);
    expect(repos.casos.listarRutaAcademicaPorPrograma).toHaveBeenCalledWith(
      'P1',
    );
    expect(lista).toEqual(pendientes);
    expect(lista[0]).toMatchObject({ idCaso: caso.idCaso, ruta: 'ACADEMICA' });
  });

  it('detalle en ruta académica: los planes del caso con sus seis campos', async () => {
    const caso = casoAlerta();
    caso.canalizar(RutaAtencion.ACADEMICA);
    const plan = planDe(caso);
    const { controlador, repos } = preparar(caso, [plan]);
    const detalle = await controlador.consultarCaso(jefe, caso.idCaso);
    expect(repos.planes.listar).toHaveBeenCalledWith(
      new Map([['caso', caso.idCaso]]),
    );
    expect(detalle.planes).toEqual([
      {
        idPlan: plan.idPlan,
        estado: 'ACTIVO',
        tutorNombre: 'Tutor Uno',
        tutorCodigo: 'T-01',
        cursos: [{ idCurso: 'C1', nombre: 'Cálculo', periodo: '2026-2' }],
        cronograma: 'Martes y jueves',
      },
    ]);
  });

  it('detalle en ruta académica sin plan: planes vacío', async () => {
    const caso = casoAlerta();
    caso.canalizar(RutaAtencion.ACADEMICA);
    const { controlador } = preparar(caso);
    expect((await controlador.consultarCaso(jefe, caso.idCaso)).planes).toEqual(
      [],
    );
  });

  it.each([
    ['sin ruta', null],
    ['ruta psicológica', RutaAtencion.PSICOLOGICA],
  ] as const)(
    'detalle %s: planes vacío y sin consultar los planes',
    async (_nombre, ruta) => {
      const caso = casoAlerta();
      if (ruta !== null) {
        caso.canalizar(ruta);
      }
      const { controlador, repos } = preparar(caso);
      expect(
        (await controlador.consultarCaso(jefe, caso.idCaso)).planes,
      ).toEqual([]);
      expect(repos.planes.listar).not.toHaveBeenCalled();
    },
  );
});
