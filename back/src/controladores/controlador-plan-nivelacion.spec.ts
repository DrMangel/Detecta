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
import { EstadoCaso } from '../dominio/entidades/estado-caso';
import { EstadoPlan } from '../dominio/entidades/estado-plan';
import { Estudiante } from '../dominio/entidades/estudiante';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import type { Persona } from '../dominio/entidades/persona';
import type { PlanNivelacion } from '../dominio/entidades/plan-nivelacion';
import { Programa } from '../dominio/entidades/programa';
import { Psicologo } from '../dominio/entidades/psicologo';
import { RegistroAcademico } from '../dominio/entidades/registro-academico';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import {
  ControladorPlanNivelacion,
  MENSAJES_PLAN,
} from './controlador-plan-nivelacion';
import { MENSAJE_BLOQUEO_AGOTADO } from './respuestas';
import {
  MENSAJE_LONGITUD_EXCEDIDA,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
const otroPrograma = new Programa({ idPrograma: 'P2', nombre: 'Química' });
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
const calculo = new Curso({
  idCurso: 'C1',
  nombre: 'Cálculo',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [ana],
});
const fisica = new Curso({
  idCurso: 'C2',
  nombre: 'Física',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [],
});
const jefe = new JefeDepartamento({ ...base('J1'), programa });
const jefeOtro = new JefeDepartamento({
  ...base('J2'),
  programa: otroPrograma,
});
const psicologo = new Psicologo({ ...base('PS1'), citas: [] });
const registro = new RegistroAcademico({
  idRegistro: 'R1',
  nota: 2,
  porcentajeAsistencia: 60,
  estudiante: ana,
  curso: calculo,
});

function casoAcademico(): CasoRiesgo {
  const caso = ana
    .solicitarAcompanamiento(RutaAtencion.ACADEMICA, 'Motivo', 'Lunes')
    .generarCasoRiesgo();
  caso.canalizar(RutaAtencion.ACADEMICA);
  return caso;
}

const CUERPO = {
  idCaso: 'X',
  idsCursos: ['C1'],
  tutorNombre: 'Tutor Uno',
  tutorCodigo: 'T-001',
  cronograma: 'Martes y jueves, 2 p. m.',
};

function preparar(caso: CasoRiesgo | null, plan: PlanNivelacion | null = null) {
  const repos = {
    casos: { buscarParaPrograma: jest.fn(async () => caso) },
    registros: { listar: jest.fn(async () => [registro]) },
    cursos: {
      buscarPorId: jest.fn(async (id: string) =>
        id === 'C1' ? calculo : id === 'C2' ? fisica : null,
      ),
    },
    planes: {
      guardar: jest.fn(async () => undefined),
      buscarPorId: jest.fn(async () => plan),
    },
  };
  const opciones: (OpcionesUnidadTrabajo | undefined)[] = [];
  const unidad: UnidadTrabajo = {
    ejecutar: (trabajo, opcion) => {
      opciones.push(opcion);
      return trabajo(repos as unknown as RepositoriosTransaccionales);
    },
  };
  const correo = { notificarPlanNivelacion: jest.fn(async () => undefined) };
  const controlador = new ControladorPlanNivelacion(
    new ControlAcceso(),
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

describe('ControladorPlanNivelacion: permisos', () => {
  it.each(
    [ana, psicologo].map((p) => [p.obtenerRol(), p] as [string, Persona]),
  )('%s recibe 403', async (_rol, persona) => {
    const { controlador } = preparar(casoAcademico());
    expect(
      (await errorDe(controlador.estructurarPlan(persona, CUERPO))).estado,
    ).toBe(403);
    expect(
      (await errorDe(controlador.finalizarPlan(persona, 'P'))).estado,
    ).toBe(403);
  });
});

describe('ControladorPlanNivelacion.estructurarPlan (CUD05)', () => {
  it('registra el plan ACTIVO con bloqueo del caso, el caso sigue EN_NIVELACION y se notifica al estudiante', async () => {
    const caso = casoAcademico();
    const { controlador, repos, correo, opciones } = preparar(caso);
    const respuesta = await controlador.estructurarPlan(jefe, {
      ...CUERPO,
      idCaso: caso.idCaso,
    });
    expect(respuesta.mensaje).toBe(MENSAJES_PLAN.registrado);
    expect(respuesta.plan).toMatchObject({
      idCaso: caso.idCaso,
      estado: EstadoPlan.ACTIVO,
      tutorNombre: 'Tutor Uno',
      tutorCodigo: 'T-001',
      cursos: [{ idCurso: 'C1', nombre: 'Cálculo' }],
    });
    expect(caso.estado).toBe(EstadoCaso.EN_NIVELACION);
    expect(opciones).toEqual([{ bloqueos: [`caso:${caso.idCaso}`] }]);
    expect(repos.casos.buscarParaPrograma).toHaveBeenCalledWith(
      caso.idCaso,
      'P1',
    );
    expect(repos.planes.guardar).toHaveBeenCalledTimes(1);
    expect(correo.notificarPlanNivelacion).toHaveBeenCalledTimes(1);
  });

  it('cronograma opcional: vacío se acepta', async () => {
    const caso = casoAcademico();
    const { controlador } = preparar(caso);
    const { cronograma: _omitido, ...sinCronograma } = CUERPO;
    const respuesta = await controlador.estructurarPlan(jefe, {
      ...sinCronograma,
      idCaso: caso.idCaso,
    });
    expect(respuesta.plan.cronograma).toBe('');
  });

  it.each([
    [{ ...CUERPO, tutorNombre: '  ' }, MENSAJES_PLAN.faltaTutor],
    [{ ...CUERPO, tutorCodigo: undefined }, MENSAJES_PLAN.faltaTutor],
    [{ ...CUERPO, idsCursos: [] }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ ...CUERPO, idsCursos: 'C1' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ ...CUERPO, idsCursos: [1] }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ ...CUERPO, idsCursos: ['C2'] }, MENSAJE_SOLICITUD_NO_VALIDA],
    [
      { ...CUERPO, idsCursos: ['C1', 'NO-EXISTE'] },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
    [{ ...CUERPO, tutorNombre: 'a'.repeat(151) }, MENSAJE_LONGITUD_EXCEDIDA],
    [{ ...CUERPO, tutorCodigo: 'a'.repeat(21) }, MENSAJE_LONGITUD_EXCEDIDA],
    [{ ...CUERPO, cronograma: 'a'.repeat(2001) }, MENSAJE_LONGITUD_EXCEDIDA],
    [{ ...CUERPO, tutorCodigo: 123 }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ ...CUERPO, descripcion: 'x' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ ...CUERPO, idCaso: '' }, MENSAJE_SOLICITUD_NO_VALIDA],
  ])('entrada inválida: 400 «%#»', async (cuerpo, mensaje) => {
    const caso = casoAcademico();
    const { controlador, repos } = preparar(caso);
    const entrada = { ...(cuerpo as Record<string, unknown>) };
    if (entrada['idCaso'] === 'X') {
      entrada['idCaso'] = caso.idCaso;
    }
    expect(await errorDe(controlador.estructurarPlan(jefe, entrada))).toEqual({
      estado: 400,
      mensaje,
    });
    expect(repos.planes.guardar).not.toHaveBeenCalled();
  });

  it('caso no visible (otro programa, psicosocial o inexistente): 403', async () => {
    const { controlador } = preparar(null);
    expect(
      (await errorDe(controlador.estructurarPlan(jefe, CUERPO))).estado,
    ).toBe(403);
    expect(
      (
        await errorDe(
          controlador.estructurarPlan(jefe, {
            ...CUERPO,
            idCaso: 'x'.repeat(37),
          }),
        )
      ).estado,
    ).toBe(403);
  });

  it('caso de ruta psicológica: 409 con el mensaje del dominio', async () => {
    const caso = ana
      .solicitarAcompanamiento(RutaAtencion.ACADEMICA, 'Motivo', 'Lunes')
      .generarCasoRiesgo();
    caso.canalizar(RutaAtencion.PSICOLOGICA);
    const { controlador } = preparar(caso);
    expect(
      await errorDe(
        controlador.estructurarPlan(jefe, { ...CUERPO, idCaso: caso.idCaso }),
      ),
    ).toEqual({
      estado: 409,
      mensaje: 'El plan de nivelación requiere un caso con ruta ACADEMICA',
    });
  });

  it('bloqueo vencido del caso: 409 con el texto aprobado en B7 (el bloqueo es del caso); sin correo', async () => {
    const caso = casoAcademico();
    const { controlador, unidad, correo } = preparar(caso);
    unidad.ejecutar = () => Promise.reject(new BloqueoAgotadoError());
    expect(
      await errorDe(
        controlador.estructurarPlan(jefe, { ...CUERPO, idCaso: caso.idCaso }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJE_BLOQUEO_AGOTADO });
    expect(correo.notificarPlanNivelacion).not.toHaveBeenCalled();
  });

  it('error de persistencia: 503 con el texto aprobado; sin correo', async () => {
    const caso = casoAcademico();
    const { controlador, unidad, correo } = preparar(caso);
    unidad.ejecutar = () => Promise.reject(new Error('caída'));
    expect(
      await errorDe(
        controlador.estructurarPlan(jefe, { ...CUERPO, idCaso: caso.idCaso }),
      ),
    ).toEqual({ estado: 503, mensaje: MENSAJES_PLAN.errorRegistro });
    expect(correo.notificarPlanNivelacion).not.toHaveBeenCalled();
  });
});

describe('ControladorPlanNivelacion.finalizarPlan (CUD05 1.a)', () => {
  function planActivo(): PlanNivelacion {
    return jefe.estructurarPlanNivelacion(
      casoAcademico(),
      [calculo],
      'T',
      'C',
      '',
    );
  }

  it('finaliza el plan con bloqueo del plan; el caso sigue EN_NIVELACION', async () => {
    const plan = planActivo();
    const { controlador, opciones, repos } = preparar(null, plan);
    const respuesta = await controlador.finalizarPlan(jefe, plan.idPlan);
    expect(respuesta.plan.estado).toBe(EstadoPlan.FINALIZADO);
    expect(plan.caso.estado).toBe(EstadoCaso.EN_NIVELACION);
    expect(opciones).toEqual([{ bloqueos: [`plan:${plan.idPlan}`] }]);
    expect(repos.planes.guardar).toHaveBeenCalledWith(plan);
  });

  it('ya finalizado: 409 con el mensaje del dominio', async () => {
    const plan = planActivo();
    plan.finalizar();
    const { controlador } = preparar(null, plan);
    expect(await errorDe(controlador.finalizarPlan(jefe, plan.idPlan))).toEqual(
      {
        estado: 409,
        mensaje: 'El plan de nivelación ya está finalizado',
      },
    );
  });

  it('plan de otro programa o inexistente: 403', async () => {
    const plan = planActivo();
    expect(
      (
        await errorDe(
          preparar(null, plan).controlador.finalizarPlan(jefeOtro, plan.idPlan),
        )
      ).estado,
    ).toBe(403);
    expect(
      (await errorDe(preparar(null, null).controlador.finalizarPlan(jefe, 'X')))
        .estado,
    ).toBe(403);
  });

  it('bloqueo vencido: 409 con el texto del plan', async () => {
    const { controlador, unidad } = preparar(null, planActivo());
    unidad.ejecutar = () => Promise.reject(new BloqueoAgotadoError());
    expect(await errorDe(controlador.finalizarPlan(jefe, 'X'))).toEqual({
      estado: 409,
      mensaje: MENSAJES_PLAN.bloqueoPlan,
    });
  });
});
