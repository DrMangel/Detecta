import { TipoEventoCaso } from '../aplicacion/contratos/registro-eventos-caso';
import { HttpException, Logger } from '@nestjs/common';
import type {
  OpcionesUnidadTrabajo,
  RepositoriosTransaccionales,
  UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import type { ServicioNotificacion } from '../aplicacion/servicios/servicio-notificacion';
import type { CasoRiesgo } from '../dominio/entidades/caso-riesgo';
import { EstadoCaso } from '../dominio/entidades/estado-caso';
import { Estudiante } from '../dominio/entidades/estudiante';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import { Modalidad } from '../dominio/entidades/modalidad';
import type { Persona } from '../dominio/entidades/persona';
import { Programa } from '../dominio/entidades/programa';
import { Psicologo } from '../dominio/entidades/psicologo';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import {
  ControladorPertinencia,
  MENSAJES_PERTINENCIA,
} from './controlador-pertinencia';
import {
  MENSAJE_FECHA_PASADA,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

const AHORA = new Date('2026-11-18T15:00:00Z');
const MANANA = '2026-11-19T15:00:00Z';
const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
const base = (id: string) => ({
  id,
  nombre: `Nombre ${id}`,
  correo: `${id.toLowerCase()}@ejemplo.edu.co`,
  contrasenaHash: 'h',
});
const mayor = new Estudiante({
  ...base('E1'),
  fechaNacimiento: new Date(2000, 0, 1),
  programa,
});
const menor = new Estudiante({
  ...base('E2'),
  fechaNacimiento: new Date(2010, 0, 1),
  programa,
});
const jefe = new JefeDepartamento({ ...base('J1'), programa });

function psicologos() {
  return {
    ps1: new Psicologo({ ...base('PS1'), citas: [] }),
    ps2: new Psicologo({ ...base('PS2'), citas: [] }),
  };
}

function casoPsicosocial(estudiante = mayor): CasoRiesgo {
  return estudiante
    .solicitarAcompanamiento(RutaAtencion.PSICOLOGICA, 'Motivo', 'Lunes')
    .generarCasoRiesgo();
}

function preparar(caso: CasoRiesgo | null) {
  const repos = {
    casos: {
      buscarPorId: jest.fn(async () => caso),
      guardar: jest.fn(async () => undefined),
    },
    citas: { guardar: jest.fn(async () => undefined) },
    eventos: { registrar: jest.fn(async () => undefined) },
  };
  const opciones: (OpcionesUnidadTrabajo | undefined)[] = [];
  const unidad: UnidadTrabajo = {
    ejecutar: (trabajo, opcion) => {
      opciones.push(opcion);
      return trabajo(repos as unknown as RepositoriosTransaccionales);
    },
  };
  const correo = { notificarCita: jest.fn(async () => undefined) };
  const controlador = new ControladorPertinencia(
    new ControlAcceso(),
    unidad,
    correo as unknown as ServicioNotificacion,
    () => new Date(AHORA),
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

describe('ControladorPertinencia: permisos', () => {
  it.each([mayor, jefe].map((p) => [p.obtenerRol(), p] as [string, Persona]))(
    '%s recibe 403',
    async (_rol, persona) => {
      const { controlador } = preparar(casoPsicosocial());
      expect(
        (
          await errorDe(
            controlador.evaluarPertinencia(persona, 'X', {
              pertinente: true,
              justificacion: 'x',
            }),
          )
        ).estado,
      ).toBe(403);
      expect(
        (
          await errorDe(
            controlador.programarCita(persona, 'X', {
              fechaHora: MANANA,
              modalidad: 'VIRTUAL',
            }),
          )
        ).estado,
      ).toBe(403);
    },
  );
});

describe('ControladorPertinencia.evaluarPertinencia (CUD07)', () => {
  it('pertinente: asigna al psicólogo, aprueba (EN_EVALUACION) con bloqueo del caso', async () => {
    const { ps1 } = psicologos();
    const caso = casoPsicosocial();
    const { controlador, repos, opciones } = preparar(caso);
    const respuesta = await controlador.evaluarPertinencia(ps1, caso.idCaso, {
      pertinente: true,
      justificacion: 'Requiere orientación',
    });
    expect(respuesta).toEqual({
      mensaje: MENSAJES_PERTINENCIA.aprobado,
      estado: EstadoCaso.EN_EVALUACION,
    });
    expect(caso.psicologo?.id).toBe('PS1');
    expect(repos.casos.guardar).toHaveBeenCalledWith(caso);
    expect(opciones).toEqual([{ bloqueos: [`caso:${caso.idCaso}`] }]);
  });

  it.each([
    [false, EstadoCaso.ARCHIVADO],
    [true, EstadoCaso.REORIENTADO],
  ])(
    'no pertinente con reorientar=%s: %s, con la justificación',
    async (reorientar, estado) => {
      const { ps1 } = psicologos();
      const caso = casoPsicosocial();
      const { controlador } = preparar(caso);
      const respuesta = await controlador.evaluarPertinencia(ps1, caso.idCaso, {
        pertinente: false,
        justificacion: 'Corresponde a otra área',
        reorientar,
      });
      expect(respuesta).toEqual({
        mensaje: MENSAJES_PERTINENCIA.archivadoReorientado,
        estado,
      });
      expect(caso.justificacion).toBe('Corresponde a otra área');
    },
  );

  it('tomado por otro psicólogo: 409', async () => {
    const { ps1, ps2 } = psicologos();
    const caso = casoPsicosocial();
    caso.asignarPsicologo(ps1);
    const { controlador, repos } = preparar(caso);
    expect(
      await errorDe(
        controlador.evaluarPertinencia(ps2, caso.idCaso, {
          pertinente: true,
          justificacion: 'x',
        }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJES_PERTINENCIA.tomadoPorOtro });
    expect(repos.casos.guardar).not.toHaveBeenCalled();
  });

  it('ya evaluado (CITADO): 409 «El caso ya fue evaluado.»', async () => {
    const { ps1 } = psicologos();
    const caso = casoPsicosocial();
    caso.asignarPsicologo(ps1);
    caso.programarCita(new Date(MANANA), Modalidad.VIRTUAL);
    const { controlador } = preparar(caso);
    expect(
      await errorDe(
        controlador.evaluarPertinencia(ps1, caso.idCaso, {
          pertinente: true,
          justificacion: 'x',
        }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJES_PERTINENCIA.yaEvaluado });
  });

  it('caso inexistente o fuera de la ruta psicológica: 403', async () => {
    const { ps1 } = psicologos();
    expect(
      (
        await errorDe(
          preparar(null).controlador.evaluarPertinencia(ps1, 'X', {
            pertinente: true,
            justificacion: 'x',
          }),
        )
      ).estado,
    ).toBe(403);
    const academico = mayor
      .solicitarAcompanamiento(RutaAtencion.ACADEMICA, 'M', 'L')
      .generarCasoRiesgo();
    expect(
      (
        await errorDe(
          preparar(academico).controlador.evaluarPertinencia(ps1, 'X', {
            pertinente: true,
            justificacion: 'x',
          }),
        )
      ).estado,
    ).toBe(403);
  });

  it.each([
    [{ justificacion: 'x' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ pertinente: 'sí', justificacion: 'x' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [
      { pertinente: true, justificacion: 'x', reorientar: true },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
    [{ pertinente: false, justificacion: '  ' }, 'Registre la justificación'],
    [{ pertinente: true }, 'Registre la justificación'],
    [
      { pertinente: true, justificacion: 'x', otro: 1 },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
  ])('entrada inválida %j: 400 «%s»', async (cuerpo, mensaje) => {
    const { ps1 } = psicologos();
    expect(
      await errorDe(
        preparar(casoPsicosocial()).controlador.evaluarPertinencia(
          ps1,
          'X',
          cuerpo,
        ),
      ),
    ).toEqual({
      estado: 400,
      mensaje,
    });
  });
});

describe('ControladorPertinencia.programarCita (CUD07, pasos 3 a 6)', () => {
  function aprobado(estudiante = mayor) {
    const { ps1, ps2 } = psicologos();
    const caso = casoPsicosocial(estudiante);
    caso.asignarPsicologo(ps1);
    caso.aprobar();
    return { caso, ps1, ps2 };
  }

  it('programa la cita (CITADO), bloquea caso y agenda en ese orden y notifica al estudiante', async () => {
    const { caso, ps1 } = aprobado();
    const { controlador, repos, opciones, correo } = preparar(caso);
    const respuesta = await controlador.programarCita(ps1, caso.idCaso, {
      fechaHora: MANANA,
      modalidad: 'PRESENCIAL',
    });
    expect(respuesta.mensaje).toBe(MENSAJES_PERTINENCIA.citaProgramada);
    expect(respuesta.aviso).toBeUndefined();
    expect(respuesta.cita).toMatchObject({
      estado: 'PROGRAMADA',
      modalidad: 'PRESENCIAL',
      fechaHora: '2026-11-19T15:00:00.000Z',
    });
    expect(caso.estado).toBe(EstadoCaso.CITADO);
    expect(opciones).toEqual([
      { bloqueos: [`caso:${caso.idCaso}`, 'agenda:PS1'] },
    ]);
    expect(repos.casos.guardar).toHaveBeenCalledWith(caso);
    expect(repos.citas.guardar).toHaveBeenCalledTimes(1);
    expect(correo.notificarCita).toHaveBeenCalledWith(
      expect.anything(),
      mayor,
      false,
    );
  });

  it('menor sin consentimiento: aviso en la respuesta y requisito en el correo', async () => {
    const { caso, ps1 } = aprobado(menor);
    const { controlador, correo } = preparar(caso);
    const respuesta = await controlador.programarCita(ps1, caso.idCaso, {
      fechaHora: MANANA,
      modalidad: 'VIRTUAL',
    });
    expect(respuesta.aviso).toBe(MENSAJES_PERTINENCIA.requiereConsentimiento);
    expect(correo.notificarCita).toHaveBeenCalledWith(
      expect.anything(),
      menor,
      true,
    );
  });

  it('cruce de horario en la agenda: 409', async () => {
    const { caso, ps1 } = aprobado();
    const otro = casoPsicosocial();
    otro.asignarPsicologo(ps1);
    otro.programarCita(new Date(MANANA), Modalidad.VIRTUAL);
    const { controlador, repos } = preparar(caso);
    expect(
      await errorDe(
        controlador.programarCita(ps1, caso.idCaso, {
          fechaHora: MANANA,
          modalidad: 'VIRTUAL',
        }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJES_PERTINENCIA.cruceHorario });
    expect(repos.casos.guardar).not.toHaveBeenCalled();
  });

  it('caso de otro psicólogo: 403; caso no aprobado o ya citado: 409', async () => {
    const { caso, ps2, ps1 } = aprobado();
    expect(
      (
        await errorDe(
          preparar(caso).controlador.programarCita(ps2, caso.idCaso, {
            fechaHora: MANANA,
            modalidad: 'VIRTUAL',
          }),
        )
      ).estado,
    ).toBe(403);
    caso.programarCita(new Date('2026-11-20T15:00:00Z'), Modalidad.VIRTUAL);
    expect(
      await errorDe(
        preparar(caso).controlador.programarCita(ps1, caso.idCaso, {
          fechaHora: MANANA,
          modalidad: 'VIRTUAL',
        }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJES_PERTINENCIA.yaEvaluado });
  });

  it.each([
    [
      { fechaHora: '2026-11-18T15:00:00Z', modalidad: 'VIRTUAL' },
      MENSAJE_FECHA_PASADA,
    ],
    [
      { fechaHora: '2026-11-17T10:00:00-05:00', modalidad: 'VIRTUAL' },
      MENSAJE_FECHA_PASADA,
    ],
    [
      { fechaHora: '2026-11-19T15:00:00', modalidad: 'VIRTUAL' },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
    [
      { fechaHora: '19/11/2026 10:00', modalidad: 'VIRTUAL' },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
    [
      { fechaHora: '2026-13-45T15:00:00Z', modalidad: 'VIRTUAL' },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
    [
      { fechaHora: MANANA, modalidad: 'TELEFONICA' },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
    [{ fechaHora: MANANA }, MENSAJE_SOLICITUD_NO_VALIDA],
    [
      { fechaHora: 1763564400000, modalidad: 'VIRTUAL' },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
  ])('entrada inválida %j: 400 «%s» (reloj fijo)', async (cuerpo, mensaje) => {
    const { caso, ps1 } = aprobado();
    expect(
      await errorDe(
        preparar(caso).controlador.programarCita(ps1, caso.idCaso, cuerpo),
      ),
    ).toEqual({
      estado: 400,
      mensaje,
    });
  });

  it('error de persistencia: 503 «Error al registrar la información del expediente»', async () => {
    const { caso, ps1 } = aprobado();
    const { controlador, unidad } = preparar(caso);
    unidad.ejecutar = () => Promise.reject(new Error('caída'));
    expect(
      await errorDe(
        controlador.programarCita(ps1, caso.idCaso, {
          fechaHora: MANANA,
          modalidad: 'VIRTUAL',
        }),
      ),
    ).toEqual({ estado: 503, mensaje: MENSAJES_PERTINENCIA.errorExpediente });
  });
});

describe('Trazabilidad (B9; ER 1.3.4, CUD04): eventos del dictamen y de la cita', () => {
  it.each([
    [true, false, TipoEventoCaso.DICTAMEN_APROBADO],
    [false, false, TipoEventoCaso.DICTAMEN_ARCHIVADO],
    [false, true, TipoEventoCaso.DICTAMEN_REORIENTADO],
  ])(
    'pertinente=%s, reorientar=%s: un evento %s con autor, sin la justificación',
    async (pertinente, reorientar, tipo) => {
      const { ps1 } = psicologos();
      const caso = casoPsicosocial();
      const { controlador, repos } = preparar(caso);
      await controlador.evaluarPertinencia(ps1, caso.idCaso, {
        pertinente,
        justificacion: 'Texto confidencial',
        ...(reorientar ? { reorientar } : {}),
      });
      expect(repos.eventos.registrar).toHaveBeenCalledTimes(1);
      // toHaveBeenCalledWith exacto: solo identificadores y tipo.
      expect(repos.eventos.registrar).toHaveBeenCalledWith({
        tipo,
        idCaso: caso.idCaso,
        idActor: 'PS1',
      });
    },
  );

  it('dictamen rechazado (tomado por otro): sin evento', async () => {
    const { ps1, ps2 } = psicologos();
    const caso = casoPsicosocial();
    caso.asignarPsicologo(ps1);
    const { controlador, repos } = preparar(caso);
    await errorDe(
      controlador.evaluarPertinencia(ps2, caso.idCaso, {
        pertinente: true,
        justificacion: 'x',
      }),
    );
    expect(repos.eventos.registrar).not.toHaveBeenCalled();
  });

  it('programarCita: un evento CITA_PROGRAMADA con la cita y el autor; con cruce, ninguno', async () => {
    const { ps1 } = psicologos();
    const caso = casoPsicosocial();
    caso.asignarPsicologo(ps1);
    caso.aprobar();
    const { controlador, repos } = preparar(caso);
    const respuesta = await controlador.programarCita(ps1, caso.idCaso, {
      fechaHora: MANANA,
      modalidad: 'PRESENCIAL',
    });
    expect(repos.eventos.registrar).toHaveBeenCalledTimes(1);
    expect(repos.eventos.registrar).toHaveBeenCalledWith({
      tipo: TipoEventoCaso.CITA_PROGRAMADA,
      idCaso: caso.idCaso,
      idActor: 'PS1',
      idCita: respuesta.cita.idCita,
    });

    // Misma hora en la agenda de PS1: cruce (409) y ningún evento.
    const otro = casoPsicosocial();
    otro.asignarPsicologo(ps1);
    otro.aprobar();
    const segunda = preparar(otro);
    expect(
      await errorDe(
        segunda.controlador.programarCita(ps1, otro.idCaso, {
          fechaHora: MANANA,
          modalidad: 'VIRTUAL',
        }),
      ),
    ).toEqual({ estado: 409, mensaje: MENSAJES_PERTINENCIA.cruceHorario });
    expect(segunda.repos.eventos.registrar).not.toHaveBeenCalled();
  });
});
