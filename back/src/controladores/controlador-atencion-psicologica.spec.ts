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
import { EstadoCita } from '../dominio/entidades/estado-cita';
import { Estudiante } from '../dominio/entidades/estudiante';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import { Modalidad } from '../dominio/entidades/modalidad';
import type { Persona } from '../dominio/entidades/persona';
import { Programa } from '../dominio/entidades/programa';
import { Psicologo } from '../dominio/entidades/psicologo';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import { TipoAsesoria } from '../dominio/entidades/tipo-asesoria';
import {
  ControladorAtencionPsicologica,
  MENSAJES_ATENCION,
} from './controlador-atencion-psicologica';
import { MENSAJES_PERTINENCIA } from './controlador-pertinencia';
import {
  MENSAJE_FECHA_PASADA,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

const AHORA = new Date('2026-11-18T15:00:00Z');
const MANANA = new Date('2026-11-19T15:00:00Z');
const PASADO_MANANA = '2026-11-20T15:00:00Z';
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

/** Caso citado de PS1 con una cita mañana. */
function citado(estudiante = mayor) {
  const ps1 = new Psicologo({ ...base('PS1'), citas: [] });
  const ps2 = new Psicologo({ ...base('PS2'), citas: [] });
  const caso = estudiante
    .solicitarAcompanamiento(
      RutaAtencion.PSICOLOGICA,
      'Motivo reservado',
      'Lunes',
    )
    .generarCasoRiesgo();
  caso.asignarPsicologo(ps1);
  caso.aprobar();
  const cita = caso.programarCita(MANANA, Modalidad.PRESENCIAL);
  return { caso, cita, ps1, ps2 };
}

function preparar(
  caso: CasoRiesgo | null,
  delPsicologo: CasoRiesgo[] = caso ? [caso] : [],
) {
  const repos = {
    casos: {
      buscarPorId: jest.fn(async () => caso),
      guardar: jest.fn(async () => undefined),
      listarPorPsicologo: jest.fn(async () => delPsicologo),
      listarPendientesRutaPsicologica: jest.fn(async () => [] as CasoRiesgo[]),
    },
    citas: { guardar: jest.fn(async () => undefined) },
    asesorias: { guardar: jest.fn(async () => undefined) },
    eventos: { registrar: jest.fn(async () => undefined) },
    registros: { listar: jest.fn(async () => []) },
  };
  const opciones: (OpcionesUnidadTrabajo | undefined)[] = [];
  const unidad: UnidadTrabajo = {
    ejecutar: (trabajo, opcion) => {
      opciones.push(opcion);
      return trabajo(repos as unknown as RepositoriosTransaccionales);
    },
  };
  const correo = { notificarCita: jest.fn(async () => undefined) };
  const controlador = new ControladorAtencionPsicologica(
    new ControlAcceso(),
    repos.casos as never,
    repos.registros as never,
    unidad,
    correo as unknown as ServicioNotificacion,
    () => new Date(AHORA),
  );
  return { controlador, repos, correo, opciones, unidad };
}

async function errorDe(
  promesa: Promise<unknown>,
): Promise<{ estado: number; cuerpo: Record<string, unknown> }> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse();
      return {
        estado: error.getStatus(),
        cuerpo:
          typeof cuerpo === 'string'
            ? { message: cuerpo }
            : (cuerpo as Record<string, unknown>),
      };
    }
    throw error;
  }
  throw new Error('se esperaba un error HTTP');
}

const RESULTADO = {
  tipo: 'ORIENTACION',
  observaciones: 'Sesión productiva',
  acuerdos: 'Volver en una semana',
  asistencia: true,
  requiereSeguimiento: true,
  presentaRiesgoCritico: false,
};

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('ControladorAtencionPsicologica: permisos y D19', () => {
  it.each([mayor, jefe].map((p) => [p.obtenerRol(), p] as [string, Persona]))(
    '%s recibe 403 en todas las operaciones',
    async (_rol, persona) => {
      const { caso, cita } = citado();
      const { controlador } = preparar(caso);
      for (const promesa of [
        controlador.listarCasosPsicologo(persona),
        controlador.consultarCaso(persona, caso.idCaso),
        controlador.reprogramarCita(persona, cita.idCita, {
          fechaHora: PASADO_MANANA,
          modalidad: 'VIRTUAL',
        }),
        controlador.registrarResultado(
          persona,
          caso.idCaso,
          cita.idCita,
          RESULTADO,
        ),
        controlador.confirmarConsentimiento(persona, caso.idCaso),
        controlador.programarSeguimiento(persona, caso.idCaso, {
          fechaHora: PASADO_MANANA,
          modalidad: 'VIRTUAL',
        }),
        controlador.cerrarCaso(persona, caso.idCaso),
      ]) {
        expect((await errorDe(promesa)).estado).toBe(403);
      }
    },
  );

  it('otro psicólogo (PS2) no opera ni ve el caso asignado a PS1', async () => {
    const { caso, cita, ps2 } = citado();
    const { controlador, repos } = preparar(caso, []);
    for (const promesa of [
      controlador.consultarCaso(ps2, caso.idCaso),
      controlador.reprogramarCita(ps2, cita.idCita, {
        fechaHora: PASADO_MANANA,
        modalidad: 'VIRTUAL',
      }),
      controlador.registrarResultado(ps2, caso.idCaso, cita.idCita, RESULTADO),
      controlador.confirmarConsentimiento(ps2, caso.idCaso),
      controlador.programarSeguimiento(ps2, caso.idCaso, {
        fechaHora: PASADO_MANANA,
        modalidad: 'VIRTUAL',
      }),
      controlador.cerrarCaso(ps2, caso.idCaso),
    ]) {
      expect((await errorDe(promesa)).estado).toBe(403);
    }
    expect(repos.casos.guardar).not.toHaveBeenCalled();
  });

  it('listarCasosPsicologo: por evaluar + asignados, sin duplicados y con el expediente', async () => {
    const { caso, ps1 } = citado();
    const pendiente = mayor
      .solicitarAcompanamiento(
        RutaAtencion.PSICOLOGICA,
        'Otro motivo',
        'Martes',
      )
      .generarCasoRiesgo();
    const { controlador, repos } = preparar(caso);
    repos.casos.listarPendientesRutaPsicologica.mockResolvedValue([
      pendiente,
      caso,
    ]);
    const lista = await controlador.listarCasosPsicologo(ps1);
    expect(lista.map((c) => c.idCaso)).toEqual([pendiente.idCaso, caso.idCaso]);
    expect(lista[1]).toMatchObject({
      origen: { motivo: 'Motivo reservado' },
      citas: [{ estado: 'PROGRAMADA' }],
      presentaRiesgoCritico: false,
    });
  });
});

describe('reprogramarCita (sd_CUD06, 4.a; ajuste D)', () => {
  it('cambia fecha y modalidad con bloqueos caso→agenda y notifica al estudiante', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador, repos, opciones, correo } = preparar(caso);
    const respuesta = await controlador.reprogramarCita(ps1, cita.idCita, {
      fechaHora: PASADO_MANANA,
      modalidad: 'VIRTUAL',
    });
    expect(respuesta.cita).toMatchObject({
      estado: 'REPROGRAMADA',
      modalidad: 'VIRTUAL',
      fechaHora: '2026-11-20T15:00:00.000Z',
    });
    expect(opciones).toEqual([
      { bloqueos: [`caso:${caso.idCaso}`, 'agenda:PS1'] },
    ]);
    expect(repos.citas.guardar).toHaveBeenCalledWith(cita);
    expect(correo.notificarCita).toHaveBeenCalledWith(cita, mayor, false);
  });

  it('misma fecha y solo cambia la modalidad: se permite (el cruce excluye la propia cita)', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador } = preparar(caso);
    const respuesta = await controlador.reprogramarCita(ps1, cita.idCita, {
      fechaHora: MANANA.toISOString(),
      modalidad: 'VIRTUAL',
    });
    expect(respuesta.cita.modalidad).toBe('VIRTUAL');
  });

  it('fecha, hora y modalidad idénticas: 400', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador } = preparar(caso);
    expect(
      await errorDe(
        controlador.reprogramarCita(ps1, cita.idCita, {
          fechaHora: MANANA.toISOString(),
          modalidad: 'PRESENCIAL',
        }),
      ),
    ).toEqual({
      estado: 400,
      cuerpo: expect.objectContaining({ message: MENSAJE_SOLICITUD_NO_VALIDA }),
    });
  });

  it('cruce con otra cita del psicólogo: 409', async () => {
    const { caso, cita, ps1 } = citado();
    caso.programarCita(new Date(PASADO_MANANA), Modalidad.VIRTUAL);
    const { controlador } = preparar(caso);
    expect(
      await errorDe(
        controlador.reprogramarCita(ps1, cita.idCita, {
          fechaHora: PASADO_MANANA,
          modalidad: 'VIRTUAL',
        }),
      ),
    ).toEqual({
      estado: 409,
      cuerpo: expect.objectContaining({
        message: MENSAJES_PERTINENCIA.cruceHorario,
      }),
    });
  });

  it('fecha pasada: 400 con el texto aprobado; cita cerrada: 409 con el mensaje del dominio', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador } = preparar(caso);
    expect(
      await errorDe(
        controlador.reprogramarCita(ps1, cita.idCita, {
          fechaHora: '2026-11-18T09:00:00-05:00',
          modalidad: 'VIRTUAL',
        }),
      ),
    ).toEqual({
      estado: 400,
      cuerpo: expect.objectContaining({ message: MENSAJE_FECHA_PASADA }),
    });
    cita.generarAsesoria(
      TipoAsesoria.ORIENTACION,
      'Obs',
      '',
      true,
      false,
      false,
    );
    expect(
      await errorDe(
        controlador.reprogramarCita(ps1, cita.idCita, {
          fechaHora: PASADO_MANANA,
          modalidad: 'VIRTUAL',
        }),
      ),
    ).toEqual({
      estado: 409,
      cuerpo: expect.objectContaining({ message: 'La cita ya está cerrada' }),
    });
  });

  it('cita que no es del psicólogo: 403', async () => {
    const { caso, ps1 } = citado();
    const { controlador } = preparar(caso);
    expect(
      (
        await errorDe(
          controlador.reprogramarCita(ps1, 'OTRA', {
            fechaHora: PASADO_MANANA,
            modalidad: 'VIRTUAL',
          }),
        )
      ).estado,
    ).toBe(403);
  });
});

describe('registrarResultado y consentimiento (CUD08, CUD09; R06)', () => {
  it('mayor de edad: registra la asesoría, cierra la cita y guarda cita y asesoría', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador, repos } = preparar(caso);
    const respuesta = await controlador.registrarResultado(
      ps1,
      caso.idCaso,
      cita.idCita,
      RESULTADO,
    );
    expect(respuesta.mensaje).toBe(MENSAJES_ATENCION.resultadoRegistrado);
    expect(cita.estado).toBe(EstadoCita.CERRADA);
    expect(repos.citas.guardar).toHaveBeenCalledWith(cita);
    expect(repos.asesorias.guardar).toHaveBeenCalledWith(cita.asesoria);
  });

  it('menor sin consentimiento: 409 con la marca y la pregunta; nada se guarda (R06, situación 2)', async () => {
    const { caso, cita, ps1 } = citado(menor);
    const { controlador, repos } = preparar(caso);
    expect(
      await errorDe(
        controlador.registrarResultado(
          ps1,
          caso.idCaso,
          cita.idCita,
          RESULTADO,
        ),
      ),
    ).toEqual({
      estado: 409,
      cuerpo: {
        statusCode: 409,
        message: MENSAJES_ATENCION.sinConsentimiento,
        requiereConsentimiento: true,
        pregunta: MENSAJES_ATENCION.preguntaConsentimiento,
      },
    });
    expect(cita.estado).toBe(EstadoCita.PROGRAMADA);
    expect(repos.citas.guardar).not.toHaveBeenCalled();
  });

  it('menor: tras confirmar el consentimiento, el registro procede', async () => {
    const { caso, cita, ps1 } = citado(menor);
    const { controlador } = preparar(caso);
    await expect(
      controlador.confirmarConsentimiento(ps1, caso.idCaso),
    ).resolves.toEqual({
      consentimientoConfirmado: true,
    });
    expect(caso.consentimientoConfirmado).toBe(true);
    await expect(
      controlador.registrarResultado(ps1, caso.idCaso, cita.idCita, RESULTADO),
    ).resolves.toMatchObject({
      mensaje: MENSAJES_ATENCION.resultadoRegistrado,
    });
  });

  it('confirmar consentimiento de un mayor de edad: 409 con el texto aprobado', async () => {
    const { caso, ps1 } = citado();
    const { controlador } = preparar(caso);
    expect(
      await errorDe(controlador.confirmarConsentimiento(ps1, caso.idCaso)),
    ).toEqual({
      estado: 409,
      cuerpo: expect.objectContaining({
        message: MENSAJES_ATENCION.noRequiereConsentimiento,
      }),
    });
  });

  it.each([
    [{ ...RESULTADO, tipo: 'CLINICA' }],
    [{ ...RESULTADO, asistencia: 'sí' }],
    [{ ...RESULTADO, requiereSeguimiento: undefined }],
    [{ ...RESULTADO, observaciones: ['x'] }],
    [{ ...RESULTADO, extra: 1 }],
  ])('entrada inválida: 400', async (cuerpo) => {
    const { caso, cita, ps1 } = citado();
    expect(
      (
        await errorDe(
          preparar(caso).controlador.registrarResultado(
            ps1,
            caso.idCaso,
            cita.idCita,
            cuerpo,
          ),
        )
      ).estado,
    ).toBe(400);
  });
});

describe('programarSeguimiento y cerrarCaso (sd_CUD06, 6.a y 6.b)', () => {
  it('seguimiento: nueva cita, caso EN_SEGUIMIENTO, correo al estudiante', async () => {
    const { caso, ps1 } = citado();
    const { controlador, correo } = preparar(caso);
    const respuesta = await controlador.programarSeguimiento(ps1, caso.idCaso, {
      fechaHora: PASADO_MANANA,
      modalidad: 'VIRTUAL',
    });
    expect(respuesta.cita.estado).toBe('PROGRAMADA');
    expect(caso.estado).toBe(EstadoCaso.EN_SEGUIMIENTO);
    expect(correo.notificarCita).toHaveBeenCalledTimes(1);
  });

  it('seguimiento con cruce: 409', async () => {
    const { caso, ps1 } = citado();
    const { controlador } = preparar(caso);
    expect(
      await errorDe(
        controlador.programarSeguimiento(ps1, caso.idCaso, {
          fechaHora: MANANA.toISOString(),
          modalidad: 'VIRTUAL',
        }),
      ),
    ).toEqual({
      estado: 409,
      cuerpo: expect.objectContaining({
        message: MENSAJES_PERTINENCIA.cruceHorario,
      }),
    });
  });

  it('cerrar sin observaciones en la última asesoría: 409; con observaciones: «Caso cerrado»', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador } = preparar(caso);
    expect(await errorDe(controlador.cerrarCaso(ps1, caso.idCaso))).toEqual({
      estado: 409,
      cuerpo: expect.objectContaining({
        message: MENSAJES_ATENCION.observacionesVacias,
      }),
    });
    cita.generarAsesoria(
      TipoAsesoria.ORIENTACION,
      'Completa',
      '',
      true,
      false,
      false,
    );
    await expect(controlador.cerrarCaso(ps1, caso.idCaso)).resolves.toEqual({
      mensaje: MENSAJES_ATENCION.casoCerrado,
    });
    expect(caso.estado).toBe(EstadoCaso.CERRADO);
    // Un caso cerrado es terminal: el dominio lo rechaza con 409.
    expect(
      (await errorDe(controlador.cerrarCaso(ps1, caso.idCaso))).estado,
    ).toBe(409);
  });

  it('error de persistencia: 503 de sd_CUD06', async () => {
    const { caso, ps1 } = citado();
    const { controlador, unidad } = preparar(caso);
    unidad.ejecutar = () => Promise.reject(new Error('caída'));
    expect(await errorDe(controlador.cerrarCaso(ps1, caso.idCaso))).toEqual({
      estado: 503,
      cuerpo: expect.objectContaining({
        message: MENSAJES_PERTINENCIA.errorExpediente,
      }),
    });
  });
});

describe('Trazabilidad (B9; ER 1.3.4, CUD04): reprogramación, seguimiento y cierre', () => {
  it('reprogramar: un evento con fecha y modalidad anteriores y nuevas (la cita las sobrescribe)', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador, repos } = preparar(caso);
    await controlador.reprogramarCita(ps1, cita.idCita, {
      fechaHora: PASADO_MANANA,
      modalidad: 'VIRTUAL',
    });
    expect(repos.eventos.registrar).toHaveBeenCalledTimes(1);
    expect(repos.eventos.registrar).toHaveBeenCalledWith({
      tipo: TipoEventoCaso.CITA_REPROGRAMADA,
      idCaso: caso.idCaso,
      idActor: 'PS1',
      idCita: cita.idCita,
      fechaHoraAnterior: MANANA,
      fechaHoraNueva: new Date(PASADO_MANANA),
      modalidadAnterior: Modalidad.PRESENCIAL,
      modalidadNueva: Modalidad.VIRTUAL,
    });
    expect(cita.fechaHora).toEqual(new Date(PASADO_MANANA));
  });

  it('reprogramación idéntica (400): sin evento', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador, repos } = preparar(caso);
    await errorDe(
      controlador.reprogramarCita(ps1, cita.idCita, {
        fechaHora: MANANA.toISOString(),
        modalidad: 'PRESENCIAL',
      }),
    );
    expect(repos.eventos.registrar).not.toHaveBeenCalled();
  });

  it('seguimiento: un evento CITA_PROGRAMADA con la nueva cita', async () => {
    const { caso, ps1 } = citado();
    const { controlador, repos } = preparar(caso);
    const respuesta = await controlador.programarSeguimiento(ps1, caso.idCaso, {
      fechaHora: PASADO_MANANA,
      modalidad: 'VIRTUAL',
    });
    expect(repos.eventos.registrar).toHaveBeenCalledTimes(1);
    expect(repos.eventos.registrar).toHaveBeenCalledWith({
      tipo: TipoEventoCaso.CITA_PROGRAMADA,
      idCaso: caso.idCaso,
      idActor: 'PS1',
      idCita: respuesta.cita.idCita,
    });
  });

  it('cierre: un evento CASO_CERRADO solo cuando el cierre procede', async () => {
    const { caso, cita, ps1 } = citado();
    const { controlador, repos } = preparar(caso);
    await errorDe(controlador.cerrarCaso(ps1, caso.idCaso));
    expect(repos.eventos.registrar).not.toHaveBeenCalled();
    cita.generarAsesoria(
      TipoAsesoria.ORIENTACION,
      'Observaciones confidenciales',
      '',
      true,
      false,
      false,
    );
    await controlador.cerrarCaso(ps1, caso.idCaso);
    expect(repos.eventos.registrar).toHaveBeenCalledTimes(1);
    expect(repos.eventos.registrar).toHaveBeenCalledWith({
      tipo: TipoEventoCaso.CASO_CERRADO,
      idCaso: caso.idCaso,
      idActor: 'PS1',
    });
  });

  it('resultado y consentimiento no registran eventos: ya tienen autor y fecha (asesoria.fecha; B7)', async () => {
    const { caso, cita, ps1 } = citado(menor);
    const { controlador, repos } = preparar(caso);
    await controlador.confirmarConsentimiento(ps1, caso.idCaso);
    await controlador.registrarResultado(
      ps1,
      caso.idCaso,
      cita.idCita,
      RESULTADO,
    );
    expect(repos.eventos.registrar).not.toHaveBeenCalled();
  });
});
