import { HttpException, Logger } from '@nestjs/common';
import type {
  RepositoriosTransaccionales,
  UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import type { ProveedorCorreo } from '../aplicacion/contratos/proveedor-correo';
import { ServicioNotificacion } from '../aplicacion/servicios/servicio-notificacion';
import type { CasoRiesgo } from '../dominio/entidades/caso-riesgo';
import { Curso } from '../dominio/entidades/curso';
import { Docente } from '../dominio/entidades/docente';
import { EstadoCaso } from '../dominio/entidades/estado-caso';
import { Estudiante } from '../dominio/entidades/estudiante';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import { NivelRiesgo } from '../dominio/entidades/nivel-riesgo';
import type { Persona } from '../dominio/entidades/persona';
import { Programa } from '../dominio/entidades/programa';
import { Psicologo } from '../dominio/entidades/psicologo';
import { RegistroAcademico } from '../dominio/entidades/registro-academico';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import type { SolicitudAcompanamiento } from '../dominio/entidades/solicitud-acompanamiento';
import { ControladorAlertas, MENSAJES_ALERTAS } from './controlador-alertas';
import { ControladorConsultaEstudiante } from './controlador-consulta-estudiante';
import {
  ControladorSolicitudes,
  MENSAJES_SOLICITUDES,
} from './controlador-solicitudes';
import { estadoAtencion } from './respuestas';
import {
  MENSAJE_LONGITUD_EXCEDIDA,
  MENSAJE_PERIODO_OBLIGATORIO,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

/* --- Escenario en memoria --- */
const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
const ana = new Estudiante({
  id: 'E1',
  nombre: 'Ana',
  correo: 'ana@ejemplo.edu.co',
  contrasenaHash: 'h',
  fechaNacimiento: new Date(2000, 0, 1),
  programa,
});
const calculo = new Curso({
  idCurso: 'C1',
  nombre: 'Cálculo',
  periodo: '2026-2',
  ultimaSincronizacion: new Date('2026-11-17T07:00:00Z'),
  estudiantes: [ana],
});
const ajeno = new Curso({
  idCurso: 'C9',
  nombre: 'Química',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [ana],
});
const docente = new Docente({
  id: 'D1',
  nombre: 'Docente',
  correo: 'd1@ejemplo.edu.co',
  contrasenaHash: 'h',
  cursos: [calculo],
});
const jefe = new JefeDepartamento({
  id: 'J1',
  nombre: 'Jefe',
  correo: 'j1@ejemplo.edu.co',
  contrasenaHash: 'h',
  programa,
});
const psicologo = new Psicologo({
  id: 'PS1',
  nombre: 'Psicóloga',
  correo: 'ps1@ejemplo.edu.co',
  contrasenaHash: 'h',
  citas: [],
});
const registro = new RegistroAcademico({
  idRegistro: 'R1',
  nota: 2.5,
  porcentajeAsistencia: 70,
  estudiante: ana,
  curso: calculo,
});
const registroAjeno = new RegistroAcademico({
  idRegistro: 'R9',
  nota: 3,
  porcentajeAsistencia: 90,
  estudiante: ana,
  curso: ajeno,
});

function repositorios() {
  return {
    registros: {
      buscarPorId: jest.fn(async (id: string) =>
        id === 'R1' ? registro : id === 'R9' ? registroAjeno : null,
      ),
      listar: jest.fn(async () => [registro]),
      listarPorCurso: jest.fn(async () => [registro]),
      listarPorEstudiante: jest.fn(async () => [registro]),
    },
    alertas: { guardar: jest.fn(), listarPorDocente: jest.fn(async () => []) },
    solicitudes: { guardar: jest.fn() },
    casos: {
      guardar: jest.fn(),
      listarEstadosPorOrigen: jest.fn(async () => new Map()),
    },
    personas: {
      buscarJefePorPrograma: jest.fn(async () => jefe),
      listarPorRol: jest.fn(async () => [psicologo]),
    },
    cursos: {
      buscarPorId: jest.fn(async (id: string) =>
        id === 'C1' ? calculo : id === 'C9' ? ajeno : null,
      ),
    },
  };
}

type Repos = ReturnType<typeof repositorios>;

function unidad(repos: Repos, orden: string[] = []): UnidadTrabajo {
  repos.alertas.guardar.mockImplementation(async () => orden.push('origen'));
  repos.solicitudes.guardar.mockImplementation(async () =>
    orden.push('origen'),
  );
  repos.casos.guardar.mockImplementation(async () => orden.push('caso'));
  return {
    ejecutar: (trabajo) =>
      trabajo(repos as unknown as RepositoriosTransaccionales),
  };
}

function notificacion() {
  return {
    notificarAlertaEstudiante: jest.fn(async () => undefined),
    notificarCasoRemitido: jest.fn(async () => undefined),
  };
}

function alertas(
  repos = repositorios(),
  correo = notificacion(),
  orden?: string[],
) {
  const controlador = new ControladorAlertas(
    new ControlAcceso(),
    repos.cursos as never,
    repos.registros as never,
    repos.alertas as never,
    repos.casos as never,
    unidad(repos, orden),
    correo as unknown as ServicioNotificacion,
  );
  return { controlador, repos, correo };
}

function solicitudes(
  repos = repositorios(),
  correo = notificacion(),
  orden?: string[],
) {
  const controlador = new ControladorSolicitudes(
    new ControlAcceso(),
    unidad(repos, orden),
    correo as unknown as ServicioNotificacion,
  );
  return { controlador, repos, correo };
}

/** Estado HTTP y mensaje de un error esperado. */
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

const ALERTA_VALIDA = {
  idRegistro: 'R1',
  nivelRiesgo: NivelRiesgo.ALTO,
  descripcion: 'Inasistencias reiteradas',
};

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('Permisos (ControladorBase.verificarPermiso): 403 fuera del rol', () => {
  const otros: Persona[] = [ana, jefe, psicologo];
  it.each(otros.map((p) => [p.obtenerRol(), p]))(
    '%s no ejecuta acciones del docente',
    async (_rol, persona) => {
      const { controlador } = alertas();
      expect(
        (await errorDe(controlador.consultarCurso(persona, 'C1'))).estado,
      ).toBe(403);
      expect(
        (await errorDe(controlador.consultarAlertasEmitidas(persona, '2026-2')))
          .estado,
      ).toBe(403);
      expect(
        (await errorDe(controlador.emitirAlerta(persona, ALERTA_VALIDA)))
          .estado,
      ).toBe(403);
    },
  );

  it.each([docente, jefe, psicologo].map((p) => [p.obtenerRol(), p]))(
    '%s no ejecuta acciones del estudiante',
    async (_rol, persona) => {
      const repos = repositorios();
      const consulta = new ControladorConsultaEstudiante(
        new ControlAcceso(),
        repos.registros as never,
        repos.alertas as never,
        repos.solicitudes as never,
        repos.casos as never,
      );
      for (const promesa of [
        consulta.consultarRegistros(persona, '2026-2'),
        consulta.consultarAlertas(persona, '2026-2'),
        consulta.consultarSolicitudes(persona),
        solicitudes().controlador.radicarSolicitud(persona, {
          tipoApoyo: 'ACADEMICA',
          motivo: 'x',
        }),
      ]) {
        expect((await errorDe(promesa)).estado).toBe(403);
      }
    },
  );
});

describe('ControladorAlertas.emitirAlerta (sd_CUD03)', () => {
  it('guarda primero la alerta y después el caso, responde 201 y lanza los correos sin esperarlos', async () => {
    const orden: string[] = [];
    const correo = notificacion();
    let liberar: () => void = () => undefined;
    correo.notificarAlertaEstudiante.mockReturnValue(
      new Promise<undefined>((resolver) => {
        liberar = () => resolver(undefined);
      }),
    );
    const { controlador, repos } = alertas(repositorios(), correo, orden);

    const respuesta = await controlador.emitirAlerta(docente, ALERTA_VALIDA);

    expect(orden).toEqual(['origen', 'caso']);
    expect(respuesta.mensaje).toBe(MENSAJES_ALERTAS.emitida);
    expect(respuesta.alerta).toMatchObject({
      nivelRiesgo: 'ALTO',
      descripcion: 'Inasistencias reiteradas',
      estadoAtencion: 'PENDIENTE',
      estudiante: { id: 'E1', nombre: 'Ana' },
    });
    const caso = repos.casos.guardar.mock.calls[0]?.[0] as CasoRiesgo;
    expect(caso.ruta).toBeNull();
    expect(caso.estado).toBe(EstadoCaso.PENDIENTE);
    expect(repos.personas.buscarJefePorPrograma).toHaveBeenCalledWith('P1');
    expect(correo.notificarAlertaEstudiante).toHaveBeenCalledTimes(1);
    expect(correo.notificarCasoRemitido).toHaveBeenCalledWith(caso, [jefe]);
    liberar(); // la respuesta llegó con el correo aún pendiente
  });

  it('un fallo de correo (ServicioNotificacion real) no altera la respuesta', async () => {
    const enviar = jest.fn().mockRejectedValue(new Error('SMTP caído'));
    const servicio = new ServicioNotificacion(
      { enviar } as unknown as ProveedorCorreo,
      { urlFrontend: 'http://localhost:5173' },
    );
    const { controlador } = alertas(
      repositorios(),
      servicio as unknown as ReturnType<typeof notificacion>,
    );
    await expect(
      controlador.emitirAlerta(docente, ALERTA_VALIDA),
    ).resolves.toMatchObject({ mensaje: MENSAJES_ALERTAS.emitida });
    await servicio.onApplicationShutdown();
    expect(enviar).toHaveBeenCalledTimes(2); // estudiante y jefe, ambos fallidos
  });

  it('programa sin jefe: se guarda igual, solo se omite el correo al jefe (respuesta 8)', async () => {
    const repos = repositorios();
    repos.personas.buscarJefePorPrograma.mockResolvedValue(null as never);
    const { controlador, correo } = alertas(repos);
    const aviso = jest.spyOn(Logger.prototype, 'warn');
    const respuesta = await controlador.emitirAlerta(docente, ALERTA_VALIDA);
    expect(respuesta.mensaje).toBe(MENSAJES_ALERTAS.emitida);
    expect(repos.casos.guardar).toHaveBeenCalledTimes(1);
    expect(correo.notificarAlertaEstudiante).toHaveBeenCalledTimes(1);
    expect(correo.notificarCasoRemitido).not.toHaveBeenCalled();
    expect(String(aviso.mock.calls[0]?.[0])).not.toMatch(/@|Ana/);
  });

  it.each([
    [{ ...ALERTA_VALIDA, descripcion: '   ' }],
    [{ ...ALERTA_VALIDA, descripcion: undefined }],
    [{ ...ALERTA_VALIDA, nivelRiesgo: undefined }],
  ])(
    'campos vacíos: 400 con el mensaje de la secuencia (6.a)',
    async (cuerpo) => {
      const { controlador, repos } = alertas();
      expect(await errorDe(controlador.emitirAlerta(docente, cuerpo))).toEqual({
        estado: 400,
        mensaje: MENSAJES_ALERTAS.camposVacios,
      });
      expect(repos.alertas.guardar).not.toHaveBeenCalled();
    },
  );

  it.each(['R9', 'NO-EXISTE', 'x'.repeat(37)])(
    'registro ajeno, inexistente o imposible (%s): 403 con el mismo mensaje',
    async (idRegistro) => {
      const { controlador, repos } = alertas();
      expect(
        await errorDe(
          controlador.emitirAlerta(docente, { ...ALERTA_VALIDA, idRegistro }),
        ),
      ).toEqual({ estado: 403, mensaje: MENSAJES_ALERTAS.registroAjeno });
      expect(repos.alertas.guardar).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['un arreglo', []],
    ['texto', 'hola'],
    ['un campo desconocido', { ...ALERTA_VALIDA, estado: 'ATENDIDO' }],
    ['descripción no textual', { ...ALERTA_VALIDA, descripcion: { a: 1 } }],
    ['nivel inexistente', { ...ALERTA_VALIDA, nivelRiesgo: 'CRITICO' }],
    ['sin idRegistro', { ...ALERTA_VALIDA, idRegistro: undefined }],
  ])('cuerpo inválido (%s): 400', async (_caso, cuerpo) => {
    const { controlador } = alertas();
    expect(await errorDe(controlador.emitirAlerta(docente, cuerpo))).toEqual({
      estado: 400,
      mensaje: MENSAJE_SOLICITUD_NO_VALIDA,
    });
  });

  it('descripción de 2000 caracteres se acepta; de 2001, 400 por longitud', async () => {
    const { controlador } = alertas();
    await expect(
      controlador.emitirAlerta(docente, {
        ...ALERTA_VALIDA,
        descripcion: 'a'.repeat(2000),
      }),
    ).resolves.toBeDefined();
    expect(
      await errorDe(
        controlador.emitirAlerta(docente, {
          ...ALERTA_VALIDA,
          descripcion: 'a'.repeat(2001),
        }),
      ),
    ).toEqual({ estado: 400, mensaje: MENSAJE_LONGITUD_EXCEDIDA });
  });

  it('error de persistencia: 503 «Error al registrar la alerta» y sin correos', async () => {
    const repos = repositorios();
    const { controlador, correo } = alertas(repos);
    repos.casos.guardar.mockRejectedValue(new Error('conexión perdida'));
    expect(
      await errorDe(controlador.emitirAlerta(docente, ALERTA_VALIDA)),
    ).toEqual({
      estado: 503,
      mensaje: MENSAJES_ALERTAS.errorRegistro,
    });
    expect(correo.notificarAlertaEstudiante).not.toHaveBeenCalled();
  });
});

describe('ControladorAlertas: consultas del docente (sd_CUD01)', () => {
  it('consultarCurso: notas, asistencia y última sincronización', async () => {
    const { controlador } = alertas();
    await expect(controlador.consultarCurso(docente, 'C1')).resolves.toEqual({
      curso: {
        idCurso: 'C1',
        nombre: 'Cálculo',
        periodo: '2026-2',
        ultimaSincronizacion: '2026-11-17T07:00:00.000Z',
      },
      registros: [
        {
          idRegistro: 'R1',
          estudiante: { id: 'E1', nombre: 'Ana' },
          nota: 2.5,
          porcentajeAsistencia: 70,
        },
      ],
    });
  });

  it('consultarCurso sin registros: «Información no disponible» (4.a)', async () => {
    const repos = repositorios();
    repos.registros.listarPorCurso.mockResolvedValue([]);
    const { controlador } = alertas(repos);
    await expect(
      controlador.consultarCurso(docente, 'C1'),
    ).resolves.toMatchObject({
      registros: [],
      mensaje: 'Información no disponible',
    });
  });

  it.each(['C9', 'NO-EXISTE', 'x'.repeat(37)])(
    'consultarCurso ajeno o inexistente (%s): 403 con el mismo mensaje',
    async (idCurso) => {
      const { controlador } = alertas();
      expect(
        await errorDe(controlador.consultarCurso(docente, idCurso)),
      ).toEqual({
        estado: 403,
        mensaje: MENSAJES_ALERTAS.cursoAjeno,
      });
    },
  );

  it('consultarAlertasEmitidas usa el estado derivado del caso, con una sola consulta de estados', async () => {
    const repos = repositorios();
    const { controlador } = alertas(repos);
    const a1 = docente.emitirAlerta(registro, NivelRiesgo.BAJO, 'uno');
    const a2 = docente.emitirAlerta(registro, NivelRiesgo.MEDIO, 'dos');
    repos.alertas.listarPorDocente.mockResolvedValue([a1, a2] as never);
    repos.casos.listarEstadosPorOrigen.mockResolvedValue(
      new Map([
        [a1.idOrigen, EstadoCaso.PENDIENTE],
        [a2.idOrigen, EstadoCaso.EN_NIVELACION],
      ]) as never,
    );
    const respuesta = await controlador.consultarAlertasEmitidas(
      docente,
      '2026-2',
    );
    expect(respuesta.map((a) => a.estadoAtencion)).toEqual([
      'PENDIENTE',
      'ATENDIDA',
    ]);
    expect(repos.casos.listarEstadosPorOrigen).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(respuesta)).not.toMatch(/EN_NIVELACION|ACADEMICA/);
  });
});

describe('periodo obligatorio (ajuste D)', () => {
  it.each([
    [undefined, MENSAJE_PERIODO_OBLIGATORIO],
    ['', MENSAJE_PERIODO_OBLIGATORIO],
    ['   ', MENSAJE_PERIODO_OBLIGATORIO],
    [['2026-1', '2026-2'], MENSAJE_SOLICITUD_NO_VALIDA],
    [{ a: '1' }, MENSAJE_SOLICITUD_NO_VALIDA],
    ['x'.repeat(21), MENSAJE_LONGITUD_EXCEDIDA],
  ])('periodo %j: 400 «%s»', async (periodo, mensaje) => {
    const { controlador } = alertas();
    expect(
      await errorDe(controlador.consultarAlertasEmitidas(docente, periodo)),
    ).toEqual({
      estado: 400,
      mensaje,
    });
  });

  it('20 caracteres de texto libre se aceptan', async () => {
    const { controlador } = alertas();
    await expect(
      controlador.consultarAlertasEmitidas(docente, 'x'.repeat(20)),
    ).resolves.toEqual([]);
  });
});

describe('ControladorSolicitudes.radicarSolicitud (sd_CUD02)', () => {
  it('psicosocial: guarda origen y caso, ruta PSICOLOGICA, notifica a los psicólogos y devuelve el comprobante', async () => {
    const orden: string[] = [];
    const { controlador, repos, correo } = solicitudes(
      repositorios(),
      notificacion(),
      orden,
    );
    const comprobante = await controlador.radicarSolicitud(ana, {
      tipoApoyo: 'PSICOLOGICA',
      motivo: 'Me siento sobrepasada',
      disponibilidad: 'Martes en la tarde',
    });
    expect(orden).toEqual(['origen', 'caso']);
    const caso = repos.casos.guardar.mock.calls[0]?.[0] as CasoRiesgo;
    expect(caso.ruta).toBe(RutaAtencion.PSICOLOGICA);
    expect(caso.confidencialidad).toBe(true);
    expect(repos.personas.listarPorRol).toHaveBeenCalledWith('PSICOLOGO');
    expect(correo.notificarCasoRemitido).toHaveBeenCalledWith(caso, [
      psicologo,
    ]);
    const origen = repos.solicitudes.guardar.mock
      .calls[0]?.[0] as SolicitudAcompanamiento;
    expect(comprobante).toEqual({
      codigo: origen.idOrigen,
      fecha: origen.fecha.toISOString(),
      tipoApoyo: 'PSICOLOGICA',
      motivo: 'Me siento sobrepasada',
      disponibilidad: 'Martes en la tarde',
      estado: 'PENDIENTE',
    });
  });

  it('académica: sin ruta, notifica al jefe del programa; disponibilidad no es obligatoria', async () => {
    const { controlador, repos, correo } = solicitudes();
    const comprobante = await controlador.radicarSolicitud(ana, {
      tipoApoyo: 'ACADEMICA',
      motivo: 'Necesito apoyo en Cálculo',
    });
    const caso = repos.casos.guardar.mock.calls[0]?.[0] as CasoRiesgo;
    expect(caso.ruta).toBeNull();
    expect(repos.personas.buscarJefePorPrograma).toHaveBeenCalledWith('P1');
    expect(correo.notificarCasoRemitido).toHaveBeenCalledWith(caso, [jefe]);
    expect(comprobante.disponibilidad).toBe('');
  });

  it('D21: sin registros académicos, 403 con el texto nuevo y nada guardado', async () => {
    const repos = repositorios();
    repos.registros.listar.mockResolvedValue([]);
    const { controlador } = solicitudes(repos);
    expect(
      await errorDe(
        controlador.radicarSolicitud(ana, {
          tipoApoyo: 'ACADEMICA',
          motivo: 'x',
        }),
      ),
    ).toEqual({ estado: 403, mensaje: MENSAJES_SOLICITUDES.sinMatricula });
    expect(repos.registros.listar).toHaveBeenCalledWith(
      new Map([['idEstudiante', 'E1']]),
    );
    expect(repos.solicitudes.guardar).not.toHaveBeenCalled();
  });

  it.each([
    [
      { tipoApoyo: 'ACADEMICA', motivo: '  ' },
      'Describa el motivo de la solicitud',
    ],
    [{ tipoApoyo: 'ACADEMICA' }, 'Describa el motivo de la solicitud'],
    [{ motivo: 'x' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ tipoApoyo: 'OTRO', motivo: 'x' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ tipoApoyo: 'ACADEMICA', motivo: ['x'] }, MENSAJE_SOLICITUD_NO_VALIDA],
    [
      { tipoApoyo: 'ACADEMICA', motivo: 'x', idEstudiante: 'E2' },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
    [
      { tipoApoyo: 'ACADEMICA', motivo: 'a'.repeat(2001) },
      MENSAJE_LONGITUD_EXCEDIDA,
    ],
    [
      { tipoApoyo: 'ACADEMICA', motivo: 'x', disponibilidad: 'a'.repeat(501) },
      MENSAJE_LONGITUD_EXCEDIDA,
    ],
  ])('entrada inválida %j: 400 «%s»', async (cuerpo, mensaje) => {
    const { controlador, repos } = solicitudes();
    expect(await errorDe(controlador.radicarSolicitud(ana, cuerpo))).toEqual({
      estado: 400,
      mensaje,
    });
    expect(repos.solicitudes.guardar).not.toHaveBeenCalled();
  });

  it('error de persistencia: 503 con el mensaje de R02 y sin correo', async () => {
    const repos = repositorios();
    const { controlador, correo } = solicitudes(repos);
    repos.solicitudes.guardar.mockRejectedValue(new Error('BD caída'));
    expect(
      await errorDe(
        controlador.radicarSolicitud(ana, {
          tipoApoyo: 'ACADEMICA',
          motivo: 'x',
        }),
      ),
    ).toEqual({ estado: 503, mensaje: MENSAJES_SOLICITUDES.errorRegistro });
    expect(correo.notificarCasoRemitido).not.toHaveBeenCalled();
  });
});

describe('ControladorConsultaEstudiante (sd_CUD01, rama Estudiante)', () => {
  function consulta(repos = repositorios()) {
    return {
      repos,
      controlador: new ControladorConsultaEstudiante(
        new ControlAcceso(),
        repos.registros as never,
        repos.alertas as never,
        repos.solicitudes as never,
        repos.casos as never,
      ),
    };
  }

  it('consultarRegistros usa el id de la sesión y muestra la última sincronización', async () => {
    const { controlador, repos } = consulta();
    const respuesta = await controlador.consultarRegistros(ana, '2026-2');
    expect(repos.registros.listarPorEstudiante).toHaveBeenCalledWith(
      'E1',
      '2026-2',
    );
    expect(respuesta.registros[0]).toMatchObject({
      curso: { idCurso: 'C1', nombre: 'Cálculo', periodo: '2026-2' },
      ultimaSincronizacion: '2026-11-17T07:00:00.000Z',
    });
    expect(respuesta.mensaje).toBeUndefined();
  });

  it('consultarRegistros sin datos: «Información no disponible»', async () => {
    const repos = repositorios();
    repos.registros.listarPorEstudiante.mockResolvedValue([]);
    const { controlador } = consulta(repos);
    await expect(
      controlador.consultarRegistros(ana, '2026-1'),
    ).resolves.toEqual({
      registros: [],
      mensaje: 'Información no disponible',
    });
  });

  it('consultarAlertas: fecha, curso, nivel y descripción, sin el docente (respuesta 10)', async () => {
    const repos = {
      ...repositorios(),
      alertas: {
        guardar: jest.fn(),
        listarPorDocente: jest.fn(),
        listarPorEstudiante: jest.fn(async () => [
          docente.emitirAlerta(registro, NivelRiesgo.ALTO, 'Inasistencias'),
        ]),
      },
    };
    const { controlador } = consulta(repos as never);
    const [alerta] = await controlador.consultarAlertas(ana, '2026-2');
    expect(Object.keys(alerta ?? {}).sort()).toEqual([
      'curso',
      'descripcion',
      'fecha',
      'idAlerta',
      'nivelRiesgo',
    ]);
    expect(alerta).toMatchObject({ curso: 'Cálculo', nivelRiesgo: 'ALTO' });
    expect(JSON.stringify(alerta)).not.toContain('Docente');
  });

  it('consultarSolicitudes: estado derivado del caso (pendiente, canalizado, cerrado)', async () => {
    const s1 = ana.solicitarAcompanamiento(RutaAtencion.ACADEMICA, 'a', '');
    const s2 = ana.solicitarAcompanamiento(RutaAtencion.ACADEMICA, 'b', '');
    const s3 = ana.solicitarAcompanamiento(RutaAtencion.PSICOLOGICA, 'c', '');
    const repos = {
      ...repositorios(),
      solicitudes: {
        guardar: jest.fn(),
        listarPorEstudiante: jest.fn(async () => [s1, s2, s3]),
      },
    };
    repos.casos.listarEstadosPorOrigen.mockResolvedValue(
      new Map([
        [s1.idOrigen, EstadoCaso.PENDIENTE],
        [s2.idOrigen, EstadoCaso.EN_NIVELACION],
        [s3.idOrigen, EstadoCaso.CERRADO],
      ]) as never,
    );
    const { controlador } = consulta(repos as never);
    const respuesta = await controlador.consultarSolicitudes(ana);
    expect(respuesta.map((s) => s.estado)).toEqual([
      'PENDIENTE',
      'ATENDIDA',
      'ATENDIDA',
    ]);
    expect(repos.casos.listarEstadosPorOrigen).toHaveBeenCalledTimes(1);
  });

  it('error de persistencia: 503 «Error al consultar la información»', async () => {
    const repos = repositorios();
    repos.registros.listarPorEstudiante.mockRejectedValue(new Error('caída'));
    const { controlador } = consulta(repos);
    expect(
      await errorDe(controlador.consultarRegistros(ana, '2026-2')),
    ).toEqual({
      estado: 503,
      mensaje: 'Error al consultar la información',
    });
  });
});

describe('estadoAtencion (respuesta 4)', () => {
  it('PENDIENTE solo con el caso PENDIENTE; ATENDIDA en cualquier otro estado', () => {
    for (const estado of Object.values(EstadoCaso)) {
      expect(estadoAtencion(estado)).toBe(
        estado === EstadoCaso.PENDIENTE ? 'PENDIENTE' : 'ATENDIDA',
      );
    }
  });
});
