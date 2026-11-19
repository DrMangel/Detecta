import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { hashContrasenas } from '../../src/aplicacion/servicios/hash-contrasenas';
import { RELOJ } from '../../src/aplicacion/servicios/servicio-autenticacion';
import { ServicioSincronizacion } from '../../src/aplicacion/servicios/servicio-sincronizacion';
import { GeneradorInformeRiesgo } from '../../src/aplicacion/servicios/generador-informe-riesgo';
import { AppModule } from '../../src/app.module';
import { configurarAplicacion } from '../../src/configurar-aplicacion';
import { CasoRiesgo } from '../../src/dominio/entidades/caso-riesgo';
import { Curso } from '../../src/dominio/entidades/curso';
import { Docente } from '../../src/dominio/entidades/docente';
import { Estudiante } from '../../src/dominio/entidades/estudiante';
import { JefeDepartamento } from '../../src/dominio/entidades/jefe-departamento';
import { Modalidad } from '../../src/dominio/entidades/modalidad';
import { NivelRiesgo } from '../../src/dominio/entidades/nivel-riesgo';
import { Programa } from '../../src/dominio/entidades/programa';
import { Psicologo } from '../../src/dominio/entidades/psicologo';
import { Rol } from '../../src/dominio/entidades/rol';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
import { UnidadTrabajoPersistente } from '../../src/persistencia/unidad-trabajo-persistente';
import { validarEntorno } from '../../src/validacion-entorno';
import {
  crearRepositorios,
  PERIODO,
  type Repositorios,
} from '../integracion/escenario';
import { ContadorConsultas } from '../integracion/soporte';
import { crearConector } from '../integracion/soporte-institucional';
import {
  abrirFuenteCarga,
  BASE_CARGA,
  BASE_INSTITUCIONAL_CARGA,
  estadistica,
  fuenteLectorCarga,
  maquina,
  migrarBaseCarga,
  reportar,
  vaciarBaseCarga,
} from './soporte-carga';

/*
 * Mediciones de B9 (M1 a M8) sobre detecta_carga e institucional_carga, con
 * datos sintéticos. Uso: npm run carga:preparar && npm run carga
 * (opcional: UV_THREADPOOL_SIZE=8 npm run carga). Las cifras locales no
 * equivalen a producción (ajuste G).
 */

const CONTRASENA = 'Contraseña-de-carga-1';
const AHORA = new Date('2026-11-18T15:00:00Z');
const NUM_CURSOS = 34;
const NUM_DOCENTES = 6;
const NUM_PSICOLOGOS = 5;

const erroresDeRed = new Map<string, number>();
let contador: ContadorConsultas;
let fuente: DataSource;
let repos: Repositorios;
let lector: DataSource;
let app: INestApplication;
let url: string;
let jwt: JwtService;
const ids = {
  estudiantes: [] as string[],
  docentes: [] as string[],
  psicologos: [] as string[],
  casosPs1: [] as string[],
};

/** Mide `trabajo`: milisegundos y consultas SQL en la fuente contada. */
async function medir<T>(trabajo: () => Promise<T>) {
  contador.total = 0;
  const inicio = performance.now();
  const resultado = await trabajo();
  return {
    ms: performance.now() - inicio,
    consultas: contador.total,
    resultado,
  };
}

async function cookieDe(id: string): Promise<string> {
  const persona = await repos.personas.buscarPorId(id);
  const token = await jwt.signAsync(
    { sub: id, rol: persona?.obtenerRol() },
    { algorithm: 'HS256', expiresIn: 3600 },
  );
  return `detecta_sesion=${token}`;
}

async function pedir(
  metodo: 'GET' | 'POST',
  ruta: string,
  cookie: string | null,
  cuerpo?: unknown,
): Promise<{ estado: number; ms: number; bytes: number }> {
  const inicio = performance.now();
  try {
    const respuesta = await fetch(`${url}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
    const bytes = (await respuesta.arrayBuffer()).byteLength;
    return { estado: respuesta.status, ms: performance.now() - inicio, bytes };
  } catch (error) {
    // Conexión cortada o rechazada: se registra como fallo (estado 0).
    const causa =
      (error as { cause?: { code?: string } }).cause?.code ?? 'DESCONOCIDO';
    erroresDeRed.set(causa, (erroresDeRed.get(causa) ?? 0) + 1);
    return { estado: 0, ms: performance.now() - inicio, bytes: 0 };
  }
}

beforeAll(async () => {
  reportar('MAQUINA', maquina());
  await migrarBaseCarga();
  await vaciarBaseCarga();
  contador = new ContadorConsultas();
  fuente = await abrirFuenteCarga(contador);
  repos = crearRepositorios(fuente);
  lector = fuenteLectorCarga();
  await lector.initialize();

  // Configuración del despliegue (D13): programa, jefe, docentes con sus
  // cursos (CARGA-01..34 repartidos) y psicólogos.
  const programa = new Programa({
    idPrograma: 'P-CARGA',
    nombre: 'Programa de Carga',
  });
  await repos.programas.guardar(programa);
  for (let d = 0; d < NUM_DOCENTES; d++) {
    const cursos: Curso[] = [];
    for (let c = d; c < NUM_CURSOS; c += NUM_DOCENTES) {
      cursos.push(
        new Curso({
          idCurso: `CARGA-${String(c + 1).padStart(2, '0')}`,
          nombre: `Asignatura de carga ${c + 1}`,
          periodo: PERIODO,
          ultimaSincronizacion: null,
          estudiantes: [],
        }),
      );
    }
    const id = `D-C${d + 1}`;
    await repos.personas.guardar(
      new Docente({
        id,
        nombre: `Docente ${d + 1}`,
        correo: `${id.toLowerCase()}@ejemplo.invalid`,
        contrasenaHash: 'x',
        cursos,
      }),
    );
    ids.docentes.push(id);
  }
  await repos.personas.guardar(
    new JefeDepartamento({
      id: 'J-CARGA',
      nombre: 'Jefe de Carga',
      correo: 'j-carga@ejemplo.invalid',
      contrasenaHash: 'x',
      programa,
    }),
  );
  for (let p = 0; p < NUM_PSICOLOGOS; p++) {
    const id = `PS-C${p + 1}`;
    await repos.personas.guardar(
      new Psicologo({
        id,
        nombre: `Psicólogo ${p + 1}`,
        correo: `${id.toLowerCase()}@ejemplo.invalid`,
        contrasenaHash: 'x',
        citas: [],
      }),
    );
    ids.psicologos.push(id);
  }

  const configuracion = new ConfigService(
    validarEntorno({
      ...process.env,
      BD_DETECTA_NOMBRE: BASE_CARGA,
      BD_INSTITUCIONAL_NOMBRE: BASE_INSTITUCIONAL_CARGA,
    }),
  );
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(configuracion)
    .overrideProvider(RELOJ)
    .useValue(() => new Date(AHORA))
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  jwt = app.get(JwtService);
});

afterAll(async () => {
  await app?.close();
  await lector?.destroy();
  await fuente?.destroy();
});

describe('Mediciones base de B9', () => {
  it('M3: sincronización (curso de 60; sincronizarTodo con ~2000 estudiantes)', async () => {
    const servicio = new ServicioSincronizacion(
      crearConector(lector, repos),
      new UnidadTrabajoPersistente(fuente),
      repos.cursos,
      () => AHORA,
    );
    const curso = await medir(() => servicio.sincronizarCurso('CARGA-01'));
    reportar('M3-detalle-curso', {
      resultado: servicio.obtenerUltimoResultado(),
    });
    const todoNuevos = await medir(() => servicio.sincronizarTodo());
    const todoExistentes = await medir(() => servicio.sincronizarTodo());
    reportar('M3', {
      cursoDe60PrimeraVez: {
        ms: Math.round(curso.ms),
        consultas: curso.consultas,
        actualizados: curso.resultado,
      },
      sincronizarTodoPrimeraVez: {
        ms: Math.round(todoNuevos.ms),
        consultas: todoNuevos.consultas,
        actualizados: todoNuevos.resultado,
      },
      sincronizarTodoSegundaVez: {
        ms: Math.round(todoExistentes.ms),
        consultas: todoExistentes.consultas,
        actualizados: todoExistentes.resultado,
      },
    });
    const filas = await fuente.query<{ id: string }[]>(
      `SELECT id FROM persona WHERE rol = 'ESTUDIANTE' ORDER BY id`,
    );
    ids.estudiantes = filas.map((f) => f.id);
    expect(ids.estudiantes.length).toBe(2040);
  });

  it('Datos de M4 a M8: ~6000 alertas y casos, ~1000 planes, 400 citas', async () => {
    const inicio = performance.now();
    const registros = await repos.registros.listar(new Map());
    const docentes = new Map<string, Docente>();
    for (const id of ids.docentes) {
      docentes.set(id, (await repos.personas.buscarPorId(id)) as Docente);
    }
    const docenteDe = (idCurso: string) =>
      [...docentes.values()].find((d) =>
        d.cursos.some((c) => c.idCurso === idCurso),
      )!;
    const jefe = (await repos.personas.buscarPorId(
      'J-CARGA',
    )) as JefeDepartamento;
    const cerrados: string[] = [];
    let planes = 0;
    for (let i = 0; i < 6000; i++) {
      const registro = registros[i % registros.length]!;
      const alerta = docenteDe(registro.curso.idCurso).emitirAlerta(
        registro,
        NivelRiesgo.MEDIO,
        'Alerta sintética',
      );
      const caso = alerta.generarCasoRiesgo();
      await repos.alertas.guardar(alerta);
      if (i % 6 === 1) {
        caso.canalizar(RutaAtencion.ACADEMICA);
      }
      await repos.casos.guardar(caso);
      if (i % 6 === 1) {
        await repos.planes.guardar(
          jefe.estructurarPlanNivelacion(
            caso,
            [registro.curso],
            'Tutor',
            'T',
            '',
          ),
        );
        planes += 1;
      } else if (i % 2 === 0) {
        cerrados.push(caso.idCaso);
      }
    }
    await fuente.query(
      `UPDATE caso_riesgo SET estado = CASE WHEN random() < 0.5 THEN 'CERRADO' ELSE 'ARCHIVADO' END WHERE id_caso = ANY($1)`,
      [cerrados],
    );
    // 400 solicitudes psicosociales con una cita: 300 de PS-C1 y 25 de cada uno de los demás.
    const psicologos = new Map<string, Psicologo>();
    for (const id of ids.psicologos) {
      psicologos.set(id, (await repos.personas.buscarPorId(id)) as Psicologo);
    }
    for (let i = 0; i < 400; i++) {
      const estudiante = (await repos.personas.buscarPorId(
        ids.estudiantes[i]!,
      )) as Estudiante;
      const caso: CasoRiesgo = estudiante
        .solicitarAcompanamiento(
          RutaAtencion.PSICOLOGICA,
          'Solicitud sintética',
          'Lunes',
        )
        .generarCasoRiesgo();
      await repos.solicitudes.guardar(caso.origen as never);
      const idPs = i < 300 ? 'PS-C1' : ids.psicologos[1 + ((i - 300) % 4)]!;
      caso.asignarPsicologo(psicologos.get(idPs)!);
      caso.aprobar();
      caso.programarCita(
        new Date(Date.UTC(2026, 11, 1) + i * 3_600_000),
        Modalidad.VIRTUAL,
      );
      await repos.casos.guardar(caso);
      if (idPs === 'PS-C1') {
        ids.casosPs1.push(caso.idCaso);
      }
    }
    reportar('DATOS', {
      alertasYCasos: 6000,
      cerradosOArchivados: cerrados.length,
      planes,
      citas: 400,
      segundos: Math.round((performance.now() - inicio) / 1000),
    });
    expect(planes).toBeGreaterThan(900);
  });

  it('M8: consultas por guardar(caso)', async () => {
    const [sinCita] = await fuente.query<{ id_caso: string }[]>(
      `SELECT id_caso FROM caso_riesgo WHERE ruta IS NULL LIMIT 1`,
    );
    const caso = await repos.casos.buscarPorId(sinCita!.id_caso);
    const conCita = await repos.casos.buscarPorId(ids.casosPs1[0]!);
    const a = await medir(() => repos.casos.guardar(caso!));
    const b = await medir(() => repos.casos.guardar(conCita!));
    reportar('M8', { casoSinCitas: a.consultas, casoConUnaCita: b.consultas });
  });

  it('M2: guard (buscarPorId de la persona de la sesión) por rol', async () => {
    const roles: [string, string][] = [
      ['ESTUDIANTE', ids.estudiantes[0]!],
      ['DOCENTE (6 cursos, ~340 estudiantes)', ids.docentes[0]!],
      ['JEFE', 'J-CARGA'],
      ['PSICOLOGO (300 citas)', 'PS-C1'],
    ];
    const resultados: Record<string, unknown> = {};
    for (const [rol, id] of roles) {
      const cookie = await cookieDe(id);
      const repo: number[] = [];
      let consultas = 0;
      const http: number[] = [];
      for (let i = 0; i < 20; i++) {
        const m = await medir(() => repos.personas.buscarPorId(id));
        repo.push(m.ms);
        consultas = m.consultas;
        http.push((await pedir('GET', '/acceso/sesion', cookie)).ms);
      }
      resultados[rol] = {
        consultasGuard: consultas,
        buscarPorIdMs: estadistica(repo),
        getSesionMs: estadistica(http),
      };
    }
    reportar('M2', resultados);
  });

  it('M1: inicio de sesión con bcrypt (costo del entorno)', async () => {
    const costo = Number(process.env['BCRYPT_COSTO'] ?? 12);
    const hash = await hashContrasenas.generar(CONTRASENA, costo);
    await fuente.query(
      `UPDATE persona SET contrasena_hash = $1 WHERE rol = 'ESTUDIANTE'`,
      [hash],
    );
    const correo = (i: number) => `carga${i + 1}@ejemplo.invalid`;
    const iniciar = (i: number) =>
      pedir('POST', '/acceso/iniciar-sesion', null, {
        correo: correo(i),
        contrasena: CONTRASENA,
      });
    const serie: number[] = [];
    for (let i = 0; i < 50; i++) {
      const r = await iniciar(i);
      expect(r.estado).toBe(200);
      serie.push(r.ms);
    }
    const lote = async (n: number) => {
      const inicio = performance.now();
      const respuestas = await Promise.all(
        Array.from({ length: n }, (_, i) => iniciar(i)),
      );
      return {
        ...estadistica(respuestas.map((r) => r.ms)),
        totalMs: Math.round(performance.now() - inicio),
        exitosos: respuestas.filter((r) => r.estado === 200).length,
      };
    };
    reportar('M1', {
      costoBcrypt: costo,
      uvThreadpoolSize: process.env['UV_THREADPOOL_SIZE'] ?? '4 (por defecto)',
      enSerie50: estadistica(serie),
      concurrentes20: await lote(20),
      concurrentes200Informativo: await lote(200),
    });
  });

  it('M5: informe de una asignatura en un programa grande', async () => {
    const cookie = await cookieDe('J-CARGA');
    const http: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await pedir('POST', '/informes', cookie, {
        periodo: PERIODO,
        idCurso: 'CARGA-01',
      });
      expect(r.estado).toBe(201);
      http.push(r.ms);
    }
    const generador = new GeneradorInformeRiesgo(
      repos.alertas,
      repos.casos,
      repos.planes,
      repos.informes,
      () => AHORA,
    );
    const jefe = await repos.personas.buscarPorId('J-CARGA');
    const curso = await repos.cursos.buscarPorId('CARGA-01');
    const m = await medir(() =>
      generador.generar(PERIODO, 'P-CARGA', curso!, jefe!),
    );
    reportar('M5', {
      postInformesMs: estadistica(http),
      generarMs: Math.round(m.ms),
      consultas: m.consultas,
      totales: {
        alertas: m.resultado?.totalAlertas,
        casos: m.resultado?.totalCasos,
        planes: m.resultado?.totalPlanes,
      },
    });
  });

  it('M6: listarPorRol(PSICOLOGO) (notificación del caso remitido)', async () => {
    const tiempos: number[] = [];
    let consultas = 0;
    for (let i = 0; i < 10; i++) {
      const m = await medir(() => repos.personas.listarPorRol(Rol.PSICOLOGO));
      tiempos.push(m.ms);
      consultas = m.consultas;
    }
    reportar('M6', {
      psicologos: NUM_PSICOLOGOS,
      citasPs1: 300,
      ms: estadistica(tiempos),
      consultas,
    });
  });

  it('M7: reprogramarCita (carga de los casos del psicólogo)', async () => {
    const tiempos: number[] = [];
    let consultas = 0;
    for (let i = 0; i < 10; i++) {
      const m = await medir(() => repos.casos.listarPorPsicologo('PS-C1'));
      tiempos.push(m.ms);
      consultas = m.consultas;
    }
    const cookie = await cookieDe('PS-C1');
    const caso = await repos.casos.buscarPorId(ids.casosPs1[0]!);
    const idCita = caso!.citas[0]!.idCita;
    const http: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await pedir(
        'POST',
        `/atencion/citas/${idCita}/reprogramacion`,
        cookie,
        {
          fechaHora: new Date(Date.UTC(2027, 0, 1 + i, 15)).toISOString(),
          modalidad: 'VIRTUAL',
        },
      );
      expect(r.estado).toBe(200);
      http.push(r.ms);
    }
    reportar('M7', {
      casosPs1: 300,
      listarPorPsicologoMs: estadistica(tiempos),
      consultas,
      postReprogramacionMs: estadistica(http),
    });
  });

  it('M4-individual: una petición de cada tipo, sin concurrencia', async () => {
    const casos: [string, 'GET' | 'POST', string, string, unknown?][] = [
      [
        'consultaRegistros',
        'GET',
        `/consulta/registros?periodo=${PERIODO}`,
        ids.estudiantes[0]!,
      ],
      [
        'consultaAlertas',
        'GET',
        `/consulta/alertas?periodo=${PERIODO}`,
        ids.estudiantes[1]!,
      ],
      [
        'radicarSolicitud',
        'POST',
        '/solicitudes',
        ids.estudiantes[2]!,
        { tipoApoyo: 'ACADEMICA', motivo: 'Solicitud de carga' },
      ],
      [
        'alertasEmitidas (docente con ~1000 alertas)',
        'GET',
        `/alertas/emitidas?periodo=${PERIODO}`,
        ids.docentes[0]!,
      ],
      ['bandejaJefe', 'GET', '/casos/pendientes', 'J-CARGA'],
      ['bandejaPsicologo PS-C1 (300 casos)', 'GET', '/atencion/casos', 'PS-C1'],
      ['bandejaPsicologo PS-C2 (25 casos)', 'GET', '/atencion/casos', 'PS-C2'],
    ];
    const resultados: Record<string, unknown> = {};
    for (const [tipo, metodo, ruta, id, cuerpo] of casos) {
      const cookie = await cookieDe(id);
      const tiempos: number[] = [];
      let ultimo = { estado: 0, bytes: 0 };
      for (let i = 0; i < 3; i++) {
        const r = await pedir(metodo, ruta, cookie, cuerpo);
        tiempos.push(r.ms);
        ultimo = r;
      }
      resultados[tipo] = {
        ...estadistica(tiempos),
        estado: ultimo.estado,
        kB: Math.round(ultimo.bytes / 1024),
      };
    }
    const [pendientes] = await fuente.query<{ total: string }[]>(
      `SELECT count(*) AS total FROM caso_riesgo WHERE estado = 'PENDIENTE' AND ruta IS NULL`,
    );
    reportar('M4-individual', {
      casosPendientesSinRuta: Number(pendientes?.total),
      ...resultados,
    });
  });

  it('M4: 200 peticiones concurrentes mezcladas, sin y con sincronización en curso', async () => {
    const cookies = {
      estudiantes: await Promise.all(
        ids.estudiantes.slice(0, 130).map(cookieDe),
      ),
      docentes: await Promise.all(ids.docentes.map(cookieDe)),
      jefe: await cookieDe('J-CARGA'),
      psicologos: await Promise.all(ids.psicologos.map(cookieDe)),
    };
    // 200 peticiones: 100 registros, 20 alertas y 10 radicaciones de
    // estudiantes; 20 emitidas de docentes; 20 bandejas del Jefe; 30 bandejas
    // de psicólogos (incluida la de PS-C1, con 300 casos).
    const peticiones: {
      tipo: string;
      hacer: () => Promise<{ estado: number; ms: number }>;
    }[] = [];
    for (let i = 0; i < 100; i++)
      peticiones.push({
        tipo: 'consultaRegistros',
        hacer: () =>
          pedir(
            'GET',
            `/consulta/registros?periodo=${PERIODO}`,
            cookies.estudiantes[i]!,
          ),
      });
    for (let i = 0; i < 20; i++)
      peticiones.push({
        tipo: 'consultaAlertas',
        hacer: () =>
          pedir(
            'GET',
            `/consulta/alertas?periodo=${PERIODO}`,
            cookies.estudiantes[100 + i]!,
          ),
      });
    for (let i = 0; i < 10; i++)
      peticiones.push({
        tipo: 'radicarSolicitud',
        hacer: () =>
          pedir('POST', '/solicitudes', cookies.estudiantes[120 + i]!, {
            tipoApoyo: 'ACADEMICA',
            motivo: 'Solicitud de carga',
          }),
      });
    for (let i = 0; i < 20; i++)
      peticiones.push({
        tipo: 'alertasEmitidas',
        hacer: () =>
          pedir(
            'GET',
            `/alertas/emitidas?periodo=${PERIODO}`,
            cookies.docentes[i % NUM_DOCENTES]!,
          ),
      });
    for (let i = 0; i < 20; i++)
      peticiones.push({
        tipo: 'bandejaJefe',
        hacer: () => pedir('GET', '/casos/pendientes', cookies.jefe),
      });
    for (let i = 0; i < 30; i++)
      peticiones.push({
        tipo: 'bandejaPsicologo',
        hacer: () =>
          pedir(
            'GET',
            '/atencion/casos',
            cookies.psicologos[i % NUM_PSICOLOGOS]!,
          ),
      });

    type PoolPg = {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
      options: { max: number };
    };
    const pool = (app.get(DataSource).driver as unknown as { master: PoolPg })
      .master;
    async function ronda() {
      const retraso = monitorEventLoopDelay({ resolution: 10 });
      retraso.enable();
      let esperaMaxima = 0;
      let enUsoMaximo = 0;
      const muestreo = setInterval(() => {
        esperaMaxima = Math.max(esperaMaxima, pool.waitingCount);
        enUsoMaximo = Math.max(enUsoMaximo, pool.totalCount - pool.idleCount);
      }, 50);
      erroresDeRed.clear();
      const inicio = performance.now();
      const resultados = await Promise.all(
        peticiones.map(async (p) => ({ tipo: p.tipo, ...(await p.hacer()) })),
      );
      const porTipo: Record<string, unknown> = {};
      for (const tipo of new Set(resultados.map((r) => r.tipo))) {
        const deTipo = resultados.filter((r) => r.tipo === tipo);
        porTipo[tipo] = {
          ...estadistica(deTipo.map((r) => r.ms)),
          errores: deTipo.filter((r) => r.estado >= 400).length,
          conexionesCortadas: deTipo.filter((r) => r.estado === 0).length,
        };
      }
      clearInterval(muestreo);
      retraso.disable();
      const diagnostico = {
        eventLoopRetrasoMs: {
          p50: Math.round(retraso.percentile(50) / 1e6),
          p99: Math.round(retraso.percentile(99) / 1e6),
          max: Math.round(retraso.max / 1e6),
        },
        pool: {
          max: pool.options.max,
          enUsoMaximo,
          peticionesEsperandoConexionMax: esperaMaxima,
        },
        erroresDeRed: Object.fromEntries(erroresDeRed),
      };
      return {
        diagnostico,
        totalMs: Math.round(performance.now() - inicio),
        todas: estadistica(resultados.map((r) => r.ms)),
        porTipo,
      };
    }
    const servidor = app.getHttpServer() as Server;
    reportar('M4-servidor', {
      keepAliveTimeoutMs: servidor.keepAliveTimeout,
      headersTimeoutMs: servidor.headersTimeout,
      requestTimeoutMs: servidor.requestTimeout,
    });
    const sinSincronizacion = await ronda();
    const sincronizacion = app.get(ServicioSincronizacion);
    const inicioSync = performance.now();
    const enCurso = sincronizacion
      .sincronizarTodo()
      .then(() => Math.round(performance.now() - inicioSync));
    await new Promise((resolver) => setTimeout(resolver, 200));
    const conSincronizacion = await ronda();
    const syncMs = await enCurso;
    reportar('M4', {
      sinSincronizacion,
      conSincronizacion,
      sincronizarTodoConcurrenteMs: syncMs,
    });
  });
});
