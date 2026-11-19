import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import {
  PROVEEDOR_CORREO,
  type ProveedorCorreo,
} from '../src/aplicacion/contratos/proveedor-correo';
import { hashContrasenas } from '../src/aplicacion/servicios/hash-contrasenas';
import { RELOJ } from '../src/aplicacion/servicios/servicio-autenticacion';
import { ServicioNotificacion } from '../src/aplicacion/servicios/servicio-notificacion';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import type {
  CasoDto,
  CasoPsicologoDto,
  CitaDto,
  DetalleDto,
} from '../src/controladores/respuestas-casos';
import { Psicologo } from '../src/dominio/entidades/psicologo';
import { RutaAtencion } from '../src/dominio/entidades/ruta-atencion';
import { validarEntorno } from '../src/validacion-entorno';
import {
  casoDeAlerta,
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
  PERIODO,
  type Escenario,
  type Repositorios,
} from './integracion/escenario';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './integracion/soporte';

/*
 * Caso de riesgo de punta a punta (criterio de cierre de B7), por HTTP real
 * contra detecta_pruebas, con un doble de ProveedorCorreo y reloj fijo
 * (respuesta 11 del plan de B7).
 */

const CONTRASENA = 'Contraseña-de-prueba-1';
/** Reloj fijo: 18/11/2026 15:00 UTC (10:00 en Bogotá). */
const AHORA = new Date('2026-11-18T15:00:00Z');

class ProveedorCorreoEnMemoria implements ProveedorCorreo {
  readonly enviados: { destino: string; asunto: string; cuerpo: string }[] = [];
  enviar(destino: string, asunto: string, cuerpo: string): Promise<boolean> {
    this.enviados.push({ destino, asunto, cuerpo });
    return Promise.resolve(true);
  }
}

type CuerpoGeneral = {
  message?: string;
  mensaje?: string;
  caso?: CasoDto;
  cita?: CitaDto;
  aviso?: string;
  estado?: string;
  requiereConsentimiento?: boolean;
  pregunta?: string;
};

interface Respuesta<T> {
  estado: number;
  cuerpo: T;
}

let app: INestApplication;
let url: string;
let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
const correo = new ProveedorCorreoEnMemoria();
const sesiones = new Map<string, string>();
const tiempos: Record<string, number[]> = { bandeja: [] };

async function sesion(usuario: string): Promise<string> {
  const guardada = sesiones.get(usuario);
  if (guardada) {
    return guardada;
  }
  const respuesta = await fetch(`${url}/acceso/iniciar-sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: usuario, contrasena: CONTRASENA }),
  });
  expect(respuesta.status).toBe(200);
  const cookie =
    respuesta.headers
      .getSetCookie()
      .find((valor) => valor.startsWith('detecta_sesion='))
      ?.split(';')[0] ?? '';
  sesiones.set(usuario, cookie);
  return cookie;
}

async function pedir<T = CuerpoGeneral>(
  usuario: string,
  metodo: 'GET' | 'POST',
  ruta: string,
  cuerpo?: unknown,
  medir?: string,
): Promise<Respuesta<T>> {
  const inicio = performance.now();
  const respuesta = await fetch(`${url}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      Cookie: await sesion(usuario),
    },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  const texto = await respuesta.text();
  if (medir) {
    tiempos[medir]?.push(performance.now() - inicio);
  }
  return {
    estado: respuesta.status,
    cuerpo: (texto === '' ? null : JSON.parse(texto)) as T,
  };
}

async function esperarCorreos(): Promise<void> {
  await app.get(ServicioNotificacion).onApplicationShutdown();
}

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
  esc = await crearEscenario(repos);
  await repos.personas.guardar(
    new Psicologo({
      id: 'PS2',
      nombre: 'Psicólogo Dos',
      correo: 'ps2@ejemplo.edu.co',
      contrasenaHash: 'x',
      citas: [],
    }),
  );
  await fuente.query('UPDATE persona SET contrasena_hash = $1', [
    await hashContrasenas.generar(CONTRASENA, 10),
  ]);

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService(
        validarEntorno({ ...process.env, BD_DETECTA_NOMBRE: BASE_PRUEBAS }),
      ),
    )
    .overrideProvider(PROVEEDOR_CORREO)
    .useValue(correo)
    .overrideProvider(RELOJ)
    .useValue(() => new Date(AHORA))
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});

afterAll(async () => {
  await app.close();
  await fuente.destroy();
  const resumen = Object.fromEntries(
    Object.entries(tiempos).map(([clave, valores]) => [
      clave,
      {
        n: valores.length,
        maxMs: Math.round(Math.max(...valores)),
        medianaMs: Math.round(
          [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)] ??
            0,
        ),
      },
    ]),
  );
  process.stdout.write(`TIEMPOS_B7 ${JSON.stringify(resumen)}\n`);
});

/** Eventos de trazabilidad del caso (B9; ER 1.3.4, CUD04), en orden. */
async function eventosDe(idCaso: string) {
  return fuente.query<
    {
      tipo: string;
      id_actor: string;
      id_cita: string | null;
      fecha_hora_anterior: Date | null;
      fecha_hora_nueva: Date | null;
      modalidad_anterior: string | null;
      modalidad_nueva: string | null;
    }[]
  >(
    `SELECT tipo, id_actor, id_cita, fecha_hora_anterior, fecha_hora_nueva,
            modalidad_anterior, modalidad_nueva
     FROM evento_caso WHERE id_caso = $1 ORDER BY ocurrido_en`,
    [idCaso],
  );
}

describe('B7a: bandeja y canalización del Jefe (R03, sd_CUD04, D18)', () => {
  it('la bandeja tiene la alerta y la solicitud académica (con su motivo), nunca la psicosocial; su detalle y su canalización dan 403', async () => {
    const alerta = await casoDeAlerta(repos, esc.d1, esc.r1);
    const academica = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.ACADEMICA,
    );
    const psicosocial = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );

    const bandeja = await pedir<CasoDto[]>(
      'j1@ejemplo.edu.co',
      'GET',
      '/casos/pendientes',
      undefined,
      'bandeja',
    );
    expect(bandeja.estado).toBe(200);
    const ids = bandeja.cuerpo.map((c) => c.idCaso);
    expect(ids).toEqual(
      expect.arrayContaining([alerta.caso.idCaso, academica.caso.idCaso]),
    );
    expect(ids).not.toContain(psicosocial.caso.idCaso);
    expect(
      bandeja.cuerpo.find((c) => c.idCaso === academica.caso.idCaso)?.origen,
    ).toMatchObject({
      tipo: 'SOLICITUD',
      motivo: 'Necesito apoyo',
      disponibilidad: 'Lunes en la tarde',
    });
    expect(JSON.stringify(bandeja.cuerpo)).not.toContain(
      psicosocial.caso.idCaso,
    );

    expect(
      (
        await pedir(
          'j1@ejemplo.edu.co',
          'GET',
          `/casos/${psicosocial.caso.idCaso}`,
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await pedir(
          'j1@ejemplo.edu.co',
          'POST',
          `/casos/${psicosocial.caso.idCaso}/canalizacion`,
          { ruta: 'ACADEMICA' },
        )
      ).estado,
    ).toBe(403);

    const detalle = await pedir<DetalleDto<CasoDto>>(
      'j1@ejemplo.edu.co',
      'GET',
      `/casos/${alerta.caso.idCaso}`,
      undefined,
      'bandeja',
    );
    expect(detalle.estado).toBe(200);
    expect(detalle.cuerpo.antecedentes.map((r) => r.idRegistro).sort()).toEqual(
      ['R0', 'R1'],
    );
  });

  it('canalizar a psicología notifica a los psicólogos; el Jefe deja de ver el motivo; el estudiante ve ATENDIDA (D27 ajustada: la canalización cuenta)', async () => {
    const academica = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.ACADEMICA,
    );
    correo.enviados.length = 0;
    const respuesta = await pedir(
      'j1@ejemplo.edu.co',
      'POST',
      `/casos/${academica.caso.idCaso}/canalizacion`,
      {
        ruta: 'PSICOLOGICA',
      },
    );
    expect(respuesta.estado).toBe(200);
    expect(respuesta.cuerpo.mensaje).toBe('Caso remitido a psicología');
    await esperarCorreos();
    expect(correo.enviados.map((c) => c.destino).sort()).toEqual([
      'ps1@ejemplo.edu.co',
      'ps2@ejemplo.edu.co',
    ]);

    const detalle = await pedir<DetalleDto<CasoDto>>(
      'j1@ejemplo.edu.co',
      'GET',
      `/casos/${academica.caso.idCaso}`,
    );
    expect(detalle.cuerpo.caso.ruta).toBe('PSICOLOGICA');
    expect(JSON.stringify(detalle.cuerpo)).not.toMatch(
      /Necesito apoyo|Lunes en la tarde/,
    );

    const propias = await pedir<{ codigo: string; estado: string }[]>(
      'e2@ejemplo.edu.co',
      'GET',
      '/consulta/solicitudes',
    );
    expect(
      propias.cuerpo.find((s) => s.codigo === academica.solicitud.idOrigen)
        ?.estado,
    ).toBe('ATENDIDA');
  });

  it('dos sesiones canalizan a la vez: una gana y la otra recibe «El caso ya fue canalizado»', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r2);
    const [a, b] = await Promise.all([
      pedir('j1@ejemplo.edu.co', 'POST', `/casos/${caso.idCaso}/canalizacion`, {
        ruta: 'ACADEMICA',
      }),
      pedir('j1@ejemplo.edu.co', 'POST', `/casos/${caso.idCaso}/canalizacion`, {
        ruta: 'PSICOLOGICA',
      }),
    ]);
    expect([a.estado, b.estado].sort((x, y) => x - y)).toEqual([200, 409]);
    expect([a, b].find((r) => r.estado === 409)?.cuerpo.message).toBe(
      'El caso ya fue canalizado',
    );
    const emitidas = await pedir<
      { idAlerta: string; estadoAtencion: string }[]
    >('d1@ejemplo.edu.co', 'GET', `/alertas/emitidas?periodo=${PERIODO}`);
    // D27 ajustada: canalizado por cualquier ruta, el docente ve ATENDIDA.
    expect(
      emitidas.cuerpo.find((x) => x.idAlerta === caso.origen.idOrigen)
        ?.estadoAtencion,
    ).toBe('ATENDIDA');
  });

  it('roles cruzados y caso de otro programa: 403', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r3); // E3 cursa P2
    expect(
      (await pedir('j1@ejemplo.edu.co', 'GET', `/casos/${caso.idCaso}`)).estado,
    ).toBe(403);
    expect(
      (await pedir('ps1@ejemplo.edu.co', 'GET', '/casos/pendientes')).estado,
    ).toBe(403);
    expect(
      (
        await pedir(
          'd1@ejemplo.edu.co',
          'POST',
          `/casos/${caso.idCaso}/canalizacion`,
          { ruta: 'ACADEMICA' },
        )
      ).estado,
    ).toBe(403);
  });
});

describe('B7b: pertinencia y cita (R05, CUD07)', () => {
  it('dos psicólogos evalúan a la vez: uno toma el caso y el otro recibe «El caso ya fue tomado por otro psicólogo»', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    const [a, b] = await Promise.all([
      pedir('ps1@ejemplo.edu.co', 'POST', `/pertinencia/${caso.idCaso}`, {
        pertinente: true,
        justificacion: 'Pertinente',
      }),
      pedir('ps2@ejemplo.edu.co', 'POST', `/pertinencia/${caso.idCaso}`, {
        pertinente: true,
        justificacion: 'Pertinente',
      }),
    ]);
    expect([a.estado, b.estado].sort((x, y) => x - y)).toEqual([200, 409]);
    expect([a, b].find((r) => r.estado === 409)?.cuerpo.message).toBe(
      'El caso ya fue tomado por otro psicólogo',
    );
  });

  it('el mismo psicólogo programa dos citas a la misma hora a la vez: una se registra y la otra recibe el cruce', async () => {
    const casos: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { caso } = await casoDeSolicitud(
        repos,
        esc.e2,
        RutaAtencion.PSICOLOGICA,
      );
      expect(
        (
          await pedir(
            'ps1@ejemplo.edu.co',
            'POST',
            `/pertinencia/${caso.idCaso}`,
            { pertinente: true, justificacion: 'Pertinente' },
          )
        ).estado,
      ).toBe(200);
      casos.push(caso.idCaso);
    }
    const cuerpo = {
      fechaHora: '2026-11-25T14:00:00-05:00',
      modalidad: 'PRESENCIAL',
    };
    const [a, b] = await Promise.all(
      casos.map((id) =>
        pedir('ps1@ejemplo.edu.co', 'POST', `/pertinencia/${id}/citas`, cuerpo),
      ),
    );
    expect([a?.estado ?? 0, b?.estado ?? 0].sort((x, y) => x - y)).toEqual([
      201, 409,
    ]);
    expect([a, b].find((r) => r?.estado === 409)?.cuerpo.message).toBe(
      'Cruce de horario. Seleccione otra hora',
    );
  });

  it('D27: una solicitud psicosocial sigue PENDIENTE para el estudiante hasta que un psicólogo la toma', async () => {
    const { solicitud, caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    const estadoDe = async () =>
      (
        await pedir<{ codigo: string; estado: string }[]>(
          'e1@ejemplo.edu.co',
          'GET',
          '/consulta/solicitudes',
        )
      ).cuerpo.find((s) => s.codigo === solicitud.idOrigen)?.estado;
    expect(await estadoDe()).toBe('PENDIENTE');
    await pedir('ps1@ejemplo.edu.co', 'POST', `/pertinencia/${caso.idCaso}`, {
      pertinente: true,
      justificacion: 'Pertinente',
    });
    expect(await estadoDe()).toBe('ATENDIDA');
  });

  it('no pertinente: archiva o reorienta con la justificación', async () => {
    const archivar = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    const reorientar = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    const r1 = await pedir<{ mensaje: string; estado: string }>(
      'ps2@ejemplo.edu.co',
      'POST',
      `/pertinencia/${archivar.caso.idCaso}`,
      {
        pertinente: false,
        justificacion: 'No amerita orientación',
      },
    );
    const r2 = await pedir<{ mensaje: string; estado: string }>(
      'ps2@ejemplo.edu.co',
      'POST',
      `/pertinencia/${reorientar.caso.idCaso}`,
      {
        pertinente: false,
        reorientar: true,
        justificacion: 'Corresponde a Bienestar',
      },
    );
    expect(r1.cuerpo).toEqual({
      mensaje: 'Caso archivado / reorientado',
      estado: 'ARCHIVADO',
    });
    expect(r2.cuerpo).toEqual({
      mensaje: 'Caso archivado / reorientado',
      estado: 'REORIENTADO',
    });
  });
});

describe('B7c: caso de riesgo de punta a punta (criterio de cierre)', () => {
  const RESULTADO = {
    tipo: 'ORIENTACION',
    observaciones: 'Se acordaron estrategias de manejo del tiempo',
    acuerdos: 'Seguimiento en dos semanas',
    asistencia: true,
    requiereSeguimiento: false,
    presentaRiesgoCritico: false,
  };

  it('mayor de edad: alerta → canalización psicológica → evaluación → cita → resultado → cierre', async () => {
    const { caso } = await casoDeAlerta(
      repos,
      esc.d1,
      esc.r1,
      'Ansiedad en clase',
    );
    expect(
      (
        await pedir(
          'j1@ejemplo.edu.co',
          'POST',
          `/casos/${caso.idCaso}/canalizacion`,
          { ruta: 'PSICOLOGICA' },
        )
      ).estado,
    ).toBe(200);
    expect(
      (
        await pedir(
          'ps1@ejemplo.edu.co',
          'POST',
          `/pertinencia/${caso.idCaso}`,
          { pertinente: true, justificacion: 'Pertinente' },
        )
      ).cuerpo.mensaje,
    ).toBe('Caso aprobado. Programe la cita');

    correo.enviados.length = 0;
    const cita = await pedir(
      'ps1@ejemplo.edu.co',
      'POST',
      `/pertinencia/${caso.idCaso}/citas`,
      {
        fechaHora: '2026-11-20T09:00:00-05:00',
        modalidad: 'PRESENCIAL',
      },
    );
    expect(cita.estado).toBe(201);
    expect(cita.cuerpo).toMatchObject({ mensaje: 'Cita programada' });
    expect(cita.cuerpo.aviso).toBeUndefined();
    await esperarCorreos();
    expect(correo.enviados.map((c) => [c.destino, c.asunto])).toEqual([
      ['e1@ejemplo.edu.co', 'DETECTA: cita programada'],
    ]);
    expect(correo.enviados[0]?.cuerpo).not.toMatch(/consentimiento|psic/i);

    // El docente ya ve ATENDIDA (el caso está CITADO).
    const emitidas = await pedir<
      { idAlerta: string; estadoAtencion: string }[]
    >('d1@ejemplo.edu.co', 'GET', `/alertas/emitidas?periodo=${PERIODO}`);
    expect(
      emitidas.cuerpo.find((a) => a.idAlerta === caso.origen.idOrigen)
        ?.estadoAtencion,
    ).toBe('ATENDIDA');

    const idCita = cita.cuerpo.cita?.idCita ?? '';
    const cerrarAntes = await pedir(
      'ps1@ejemplo.edu.co',
      'POST',
      `/atencion/casos/${caso.idCaso}/cierre`,
    );
    expect(cerrarAntes).toMatchObject({
      estado: 409,
      cuerpo: { message: 'Diligencie las observaciones de la asesoría' },
    });

    const resultado = await pedir(
      'ps1@ejemplo.edu.co',
      'POST',
      `/atencion/casos/${caso.idCaso}/citas/${idCita}/resultado`,
      RESULTADO,
    );
    expect(resultado).toMatchObject({
      estado: 201,
      cuerpo: { mensaje: 'Resultado registrado', cita: { estado: 'CERRADA' } },
    });

    const cierre = await pedir(
      'ps1@ejemplo.edu.co',
      'POST',
      `/atencion/casos/${caso.idCaso}/cierre`,
    );
    expect(cierre).toMatchObject({
      estado: 200,
      cuerpo: { mensaje: 'Caso cerrado' },
    });

    const expediente = await pedir<DetalleDto<CasoPsicologoDto>>(
      'ps1@ejemplo.edu.co',
      'GET',
      `/atencion/casos/${caso.idCaso}`,
    );
    expect(expediente.cuerpo.caso).toMatchObject({
      estado: 'CERRADO',
      citas: [{ asesoria: { observaciones: RESULTADO.observaciones } }],
    });

    // El Jefe ve el estado, nunca el expediente.
    const vistaJefe = await pedir<DetalleDto<CasoDto>>(
      'j1@ejemplo.edu.co',
      'GET',
      `/casos/${caso.idCaso}`,
    );
    expect(vistaJefe.cuerpo.caso.estado).toBe('CERRADO');
    expect(JSON.stringify(vistaJefe.cuerpo)).not.toMatch(
      /estrategias|Seguimiento en dos semanas|citas/,
    );

    // B9, trazabilidad: dictamen, cita y cierre con autor y fecha, sin
    // contenido; la canalización y la asesoría ya tienen su propia traza.
    const trazas = await eventosDe(caso.idCaso);
    expect(trazas.map((e) => [e.tipo, e.id_actor])).toEqual([
      ['DICTAMEN_APROBADO', 'PS1'],
      ['CITA_PROGRAMADA', 'PS1'],
      ['CASO_CERRADO', 'PS1'],
    ]);
    expect(JSON.stringify(trazas)).not.toMatch(
      new RegExp(`${RESULTADO.observaciones}|${RESULTADO.acuerdos}`),
    );
  });

  it('menor de edad: aviso y requisito en el correo; el resultado se bloquea hasta confirmar el consentimiento', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.PSICOLOGICA,
    ); // E2 nació en 2010
    await pedir('ps2@ejemplo.edu.co', 'POST', `/pertinencia/${caso.idCaso}`, {
      pertinente: true,
      justificacion: 'Pertinente',
    });
    correo.enviados.length = 0;
    const cita = await pedir(
      'ps2@ejemplo.edu.co',
      'POST',
      `/pertinencia/${caso.idCaso}/citas`,
      {
        fechaHora: '2026-11-21T10:00:00-05:00',
        modalidad: 'VIRTUAL',
      },
    );
    expect(cita.cuerpo.aviso).toBe(
      'La atención requiere el consentimiento informado del acudiente',
    );
    await esperarCorreos();
    expect(correo.enviados[0]?.cuerpo).toContain(
      'Antes de la cita debe presentar el consentimiento informado firmado por su acudiente.',
    );
    expect(correo.enviados[0]?.cuerpo).not.toMatch(/psic/i);

    const idCita = cita.cuerpo.cita?.idCita ?? '';
    const bloqueado = await pedir(
      'ps2@ejemplo.edu.co',
      'POST',
      `/atencion/casos/${caso.idCaso}/citas/${idCita}/resultado`,
      RESULTADO,
    );
    expect(bloqueado).toMatchObject({
      estado: 409,
      cuerpo: {
        message: 'No se puede registrar la atención sin consentimiento',
        requiereConsentimiento: true,
        pregunta: '¿El acudiente otorgó el consentimiento informado?',
      },
    });

    expect(
      (
        await pedir(
          'ps2@ejemplo.edu.co',
          'POST',
          `/atencion/casos/${caso.idCaso}/consentimiento`,
        )
      ).estado,
    ).toBe(200);
    const [traza] = await fuente.query<
      { id_psicologo_consentimiento: string; fecha_consentimiento: Date }[]
    >(
      'SELECT id_psicologo_consentimiento, fecha_consentimiento FROM caso_riesgo WHERE id_caso = $1',
      [caso.idCaso],
    );
    expect(traza?.id_psicologo_consentimiento).toBe('PS2');
    expect(traza?.fecha_consentimiento).toBeInstanceOf(Date);

    const registrado = await pedir(
      'ps2@ejemplo.edu.co',
      'POST',
      `/atencion/casos/${caso.idCaso}/citas/${idCita}/resultado`,
      RESULTADO,
    );
    expect(registrado.estado).toBe(201);
    expect(
      (
        await pedir(
          'ps2@ejemplo.edu.co',
          'POST',
          `/atencion/casos/${caso.idCaso}/cierre`,
        )
      ).estado,
    ).toBe(200);
  });

  it('confirmar el consentimiento de un mayor de edad: 409', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    await pedir('ps1@ejemplo.edu.co', 'POST', `/pertinencia/${caso.idCaso}`, {
      pertinente: true,
      justificacion: 'Pertinente',
    });
    expect(
      await pedir(
        'ps1@ejemplo.edu.co',
        'POST',
        `/atencion/casos/${caso.idCaso}/consentimiento`,
      ),
    ).toMatchObject({
      estado: 409,
      cuerpo: {
        message: 'El estudiante no requiere consentimiento informado.',
      },
    });
  });

  it('reprogramar: con cruce 409; solo la modalidad 200; idéntica 400; seguimiento 201; correo de cita reprogramada', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    await pedir('ps1@ejemplo.edu.co', 'POST', `/pertinencia/${caso.idCaso}`, {
      pertinente: true,
      justificacion: 'Pertinente',
    });
    const cita = await pedir(
      'ps1@ejemplo.edu.co',
      'POST',
      `/pertinencia/${caso.idCaso}/citas`,
      {
        fechaHora: '2026-12-01T09:00:00-05:00',
        modalidad: 'PRESENCIAL',
      },
    );
    const idCita = cita.cuerpo.cita?.idCita ?? '';
    const seguimiento = await pedir(
      'ps1@ejemplo.edu.co',
      'POST',
      `/atencion/casos/${caso.idCaso}/seguimiento`,
      {
        fechaHora: '2026-12-02T09:00:00-05:00',
        modalidad: 'VIRTUAL',
      },
    );
    expect(seguimiento.estado).toBe(201);

    expect(
      await pedir(
        'ps1@ejemplo.edu.co',
        'POST',
        `/atencion/citas/${idCita}/reprogramacion`,
        {
          fechaHora: '2026-12-02T09:00:00-05:00',
          modalidad: 'PRESENCIAL',
        },
      ),
    ).toMatchObject({
      estado: 409,
      cuerpo: { message: 'Cruce de horario. Seleccione otra hora' },
    });
    expect(
      await pedir(
        'ps1@ejemplo.edu.co',
        'POST',
        `/atencion/citas/${idCita}/reprogramacion`,
        {
          fechaHora: '2026-12-01T14:00:00Z',
          modalidad: 'VIRTUAL',
        },
      ),
    ).toMatchObject({
      estado: 200,
      cuerpo: { cita: { estado: 'REPROGRAMADA', modalidad: 'VIRTUAL' } },
    });
    expect(
      (
        await pedir(
          'ps1@ejemplo.edu.co',
          'POST',
          `/atencion/citas/${idCita}/reprogramacion`,
          {
            fechaHora: '2026-12-01T09:00:00-05:00',
            modalidad: 'VIRTUAL',
          },
        )
      ).estado,
    ).toBe(400);
    correo.enviados.length = 0;
    const reprogramada = await pedir(
      'ps1@ejemplo.edu.co',
      'POST',
      `/atencion/citas/${idCita}/reprogramacion`,
      {
        fechaHora: '2026-12-03T09:00:00-05:00',
        modalidad: 'VIRTUAL',
      },
    );
    expect(reprogramada.estado).toBe(200);
    await esperarCorreos();
    expect(correo.enviados.map((c) => [c.destino, c.asunto])).toEqual([
      ['e1@ejemplo.edu.co', 'DETECTA: cita reprogramada'],
    ]);
    expect(
      (
        await pedir(
          'ps1@ejemplo.edu.co',
          'POST',
          `/atencion/citas/${idCita}/reprogramacion`,
          {
            fechaHora: '2026-11-17T09:00:00-05:00',
            modalidad: 'VIRTUAL',
          },
        )
      ).cuerpo.message,
    ).toBe('La fecha de la cita debe ser posterior a la actual.');

    // B9, trazabilidad: historial completo de las reprogramaciones; los
    // intentos rechazados (409 y 400) no dejan evento.
    const trazas = await eventosDe(caso.idCaso);
    expect(trazas.map((e) => e.tipo)).toEqual([
      'DICTAMEN_APROBADO',
      'CITA_PROGRAMADA',
      'CITA_PROGRAMADA',
      'CITA_REPROGRAMADA',
      'CITA_REPROGRAMADA',
    ]);
    expect(trazas[1]?.id_cita).toBe(idCita);
    expect(trazas[2]?.id_cita).toBe(seguimiento.cuerpo.cita?.idCita);
    expect(trazas.slice(3)).toEqual([
      expect.objectContaining({
        id_cita: idCita,
        fecha_hora_anterior: new Date('2026-12-01T14:00:00Z'),
        fecha_hora_nueva: new Date('2026-12-01T14:00:00Z'),
        modalidad_anterior: 'PRESENCIAL',
        modalidad_nueva: 'VIRTUAL',
      }),
      expect.objectContaining({
        id_cita: idCita,
        fecha_hora_anterior: new Date('2026-12-01T14:00:00Z'),
        fecha_hora_nueva: new Date('2026-12-03T14:00:00Z'),
        modalidad_anterior: 'VIRTUAL',
        modalidad_nueva: 'VIRTUAL',
      }),
    ]);
  });

  it('D18 por HTTP: quién ve el motivo de cada solicitud (detalle del Jefe y expediente del psicólogo)', async () => {
    const academica = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.ACADEMICA,
    );
    const psicosocial = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    const motivoVisible = (cuerpo: unknown) =>
      JSON.stringify(cuerpo).includes('Necesito apoyo');

    // Académica sin canalizar: el Jefe sí; los psicólogos no (403).
    expect(
      motivoVisible(
        (
          await pedir(
            'j1@ejemplo.edu.co',
            'GET',
            `/casos/${academica.caso.idCaso}`,
          )
        ).cuerpo,
      ),
    ).toBe(true);
    expect(
      (
        await pedir(
          'ps1@ejemplo.edu.co',
          'GET',
          `/atencion/casos/${academica.caso.idCaso}`,
        )
      ).estado,
    ).toBe(403);
    // Psicosocial: el Jefe nunca (403); un psicólogo sí mientras no esté asignada a otro.
    expect(
      (
        await pedir(
          'j1@ejemplo.edu.co',
          'GET',
          `/casos/${psicosocial.caso.idCaso}`,
        )
      ).estado,
    ).toBe(403);
    expect(
      motivoVisible(
        (
          await pedir(
            'ps2@ejemplo.edu.co',
            'GET',
            `/atencion/casos/${psicosocial.caso.idCaso}`,
          )
        ).cuerpo,
      ),
    ).toBe(true);
    await pedir(
      'ps1@ejemplo.edu.co',
      'POST',
      `/pertinencia/${psicosocial.caso.idCaso}`,
      { pertinente: true, justificacion: 'Pertinente' },
    );
    expect(
      (
        await pedir(
          'ps2@ejemplo.edu.co',
          'GET',
          `/atencion/casos/${psicosocial.caso.idCaso}`,
        )
      ).estado,
    ).toBe(403);
    // Académica canalizada a psicología: el Jefe pierde el motivo; el psicólogo lo ve.
    await pedir(
      'j1@ejemplo.edu.co',
      'POST',
      `/casos/${academica.caso.idCaso}/canalizacion`,
      { ruta: 'PSICOLOGICA' },
    );
    expect(
      motivoVisible(
        (
          await pedir(
            'j1@ejemplo.edu.co',
            'GET',
            `/casos/${academica.caso.idCaso}`,
          )
        ).cuerpo,
      ),
    ).toBe(false);
    expect(
      motivoVisible(
        (
          await pedir(
            'ps1@ejemplo.edu.co',
            'GET',
            `/atencion/casos/${academica.caso.idCaso}`,
          )
        ).cuerpo,
      ),
    ).toBe(true);
  });

  it('bandejas del Jefe y del psicólogo: tiempo de respuesta', async () => {
    for (let i = 0; i < 3; i++) {
      const lista = await pedir<CasoPsicologoDto[]>(
        'ps1@ejemplo.edu.co',
        'GET',
        '/atencion/casos',
        undefined,
        'bandeja',
      );
      expect(lista.estado).toBe(200);
      await pedir<CasoDto[]>(
        'j1@ejemplo.edu.co',
        'GET',
        '/casos/pendientes',
        undefined,
        'bandeja',
      );
    }
    expect(Math.max(...(tiempos['bandeja'] ?? [Infinity]))).toBeLessThan(2000);
  });
});
