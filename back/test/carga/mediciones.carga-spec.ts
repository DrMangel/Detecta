import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { GeneradorInformeRiesgo } from '../../src/aplicacion/servicios/generador-informe-riesgo';
import { hashContrasenas } from '../../src/aplicacion/servicios/hash-contrasenas';
import { RELOJ } from '../../src/aplicacion/servicios/servicio-autenticacion';
import { ServicioSincronizacion } from '../../src/aplicacion/servicios/servicio-sincronizacion';
import { AppModule } from '../../src/app.module';
import { configurarAplicacion } from '../../src/configurar-aplicacion';
import {
  crearLimitadores,
  LIMITADORES,
} from '../../src/controladores/limitador-peticiones';
import type { CasoRiesgo } from '../../src/dominio/entidades/caso-riesgo';
import { Curso } from '../../src/dominio/entidades/curso';
import { Docente } from '../../src/dominio/entidades/docente';
import type { Estudiante } from '../../src/dominio/entidades/estudiante';
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
 * datos sintéticos (ajuste G). Dos escenarios (ajuste 2 del informe parcial):
 * - realista (por defecto; ER 3.4.1 c): 25 programas de 80 estudiantes (2000),
 *   3 cursos por programa y 2 por estudiante (~53 por curso), 75 docentes,
 *   25 jefes y 3 psicólogos;
 * - estres: 1 programa con 2040 estudiantes en 34 cursos de 60, 6 docentes,
 *   1 jefe y 5 psicólogos (uno con 300 casos).
 * Ambos con 6000 alertas y casos, 1000 planes y 400 casos psicológicos.
 *
 * Uso: npm run carga:preparar; luego CARGA_ESCENARIO=realista|estres
 * npm run carga. CARGA_REUTILIZAR=1 reutiliza los datos del mismo escenario
 * ya cargados (omite M3). Las cifras locales no equivalen a producción.
 */

const ESCENARIO =
  process.env['CARGA_ESCENARIO'] === 'estres' ? 'estres' : 'realista';
const REUTILIZAR = process.env['CARGA_REUTILIZAR'] === '1';
const CONTRASENA = 'Contraseña-de-carga-1';
const AHORA = new Date('2026-11-18T15:00:00Z');
/**
 * Repeticiones de cada medición para la mediana y la dispersión. 3 por
 * defecto; CARGA_REPETICIONES (1 a 10) la cambia, p. ej. para el barrido del
 * pool con una repetición y criterio fijado antes de medir.
 */
const REPETICIONES = (() => {
  const valor = Number(process.env['CARGA_REPETICIONES'] ?? 3);
  if (!Number.isInteger(valor) || valor < 1 || valor > 10) {
    throw new Error('CARGA_REPETICIONES debe ser un entero entre 1 y 10');
  }
  return valor;
})();

interface Configuracion {
  programas: { id: string; nombre: string; cursos: string[] }[];
  docentesPorCurso: (idCurso: string) => string;
  psicologos: number;
  /** Psicólogo (índice) de cada caso psicológico: el primero puede concentrar más. */
  psicologoDe: (i: number) => number;
  prefijoEstudiante: string;
}

function configuracion(): Configuracion {
  if (ESCENARIO === 'estres') {
    const cursos = Array.from(
      { length: 34 },
      (_, c) => `CARGA-${String(c + 1).padStart(2, '0')}`,
    );
    return {
      programas: [{ id: 'P-CARGA', nombre: 'Programa de Carga', cursos }],
      docentesPorCurso: (idCurso) =>
        `D-C${((Number(idCurso.slice(-2)) - 1) % 6) + 1}`,
      psicologos: 5,
      psicologoDe: (i) => (i < 300 ? 0 : 1 + ((i - 300) % 4)),
      prefijoEstudiante: 'EC',
    };
  }
  return {
    programas: Array.from({ length: 25 }, (_, p) => {
      const id = `PR${String(p + 1).padStart(2, '0')}`;
      return {
        id,
        nombre: `Programa Realista ${p + 1}`,
        cursos: [1, 2, 3].map((k) => `REAL-${id.slice(2)}-${k}`),
      };
    }),
    docentesPorCurso: (idCurso) => `D-${idCurso}`,
    psicologos: 3,
    psicologoDe: (i) => i % 3,
    prefijoEstudiante: 'ER',
  };
}

const CONF = configuracion();
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
  jefes: [] as string[],
  psicologos: [] as string[],
  casosPsicologo0: [] as string[],
};
const erroresDeRed = new Map<string, number>();

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

/** Mediana, mínimo y máximo de una lista de valores (dispersión entre repeticiones). */
function resumen(valores: readonly number[]) {
  const orden = [...valores].sort((a, b) => a - b);
  return {
    mediana: orden[Math.floor(orden.length / 2)] ?? 0,
    min: orden[0] ?? 0,
    max: orden.at(-1) ?? 0,
  };
}

async function cookieDe(id: string): Promise<string> {
  const persona = await repos.personas.buscarPorId(id);
  const token = await jwt.signAsync(
    { sub: id, rol: persona?.obtenerRol() },
    { algorithm: 'HS256', expiresIn: 7200 },
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
    const causa =
      (error as { cause?: { code?: string } }).cause?.code ?? 'DESCONOCIDO';
    erroresDeRed.set(causa, (erroresDeRed.get(causa) ?? 0) + 1);
    return { estado: 0, ms: performance.now() - inicio, bytes: 0 };
  }
}

async function cargarIds(): Promise<void> {
  const porRol = async (rol: string, prefijo = '') =>
    (
      await fuente.query<{ id: string }[]>(
        `SELECT id FROM persona WHERE rol = $1 AND id LIKE $2 ORDER BY id`,
        [rol, `${prefijo}%`],
      )
    ).map((f) => f.id);
  ids.estudiantes = await porRol('ESTUDIANTE', CONF.prefijoEstudiante);
  ids.docentes = await porRol('DOCENTE');
  ids.jefes = await porRol('JEFE_DEPARTAMENTO');
  ids.psicologos = await porRol('PSICOLOGO');
  ids.casosPsicologo0 = (
    await fuente.query<{ id_caso: string }[]>(
      `SELECT id_caso FROM caso_riesgo WHERE id_psicologo = $1 ORDER BY id_caso`,
      [ids.psicologos[0]],
    )
  ).map((f) => f.id_caso);
}

async function datosYaCargados(): Promise<boolean> {
  const [fila] = await fuente.query<{ programas: string; alertas: string }[]>(
    `SELECT (SELECT count(*) FROM programa WHERE id_programa = $1) AS programas,
            (SELECT count(*) FROM origen_riesgo WHERE tipo = 'ALERTA') AS alertas`,
    [CONF.programas[0]?.id],
  );
  return Number(fila?.programas) === 1 && Number(fila?.alertas) >= 6000;
}

beforeAll(async () => {
  reportar('MAQUINA', {
    escenario: ESCENARIO,
    repeticiones: REPETICIONES,
    ...maquina(),
  });
  await migrarBaseCarga();
  contador = new ContadorConsultas();
  fuente = await abrirFuenteCarga(contador);
  repos = crearRepositorios(fuente);
  lector = fuenteLectorCarga();
  await lector.initialize();
  const reutilizar = REUTILIZAR && (await datosYaCargados());
  reportar('REUTILIZA_DATOS', { reutilizar });

  if (!reutilizar) {
    await vaciarBaseCarga();
    // Configuración del despliegue (D13): programas, jefes, docentes y psicólogos.
    const docentes = new Map<string, Curso[]>();
    for (const [p, datos] of CONF.programas.entries()) {
      const programa = new Programa({
        idPrograma: datos.id,
        nombre: datos.nombre,
      });
      await repos.programas.guardar(programa);
      const idJefe = CONF.programas.length === 1 ? 'J-CARGA' : `J-${datos.id}`;
      await repos.personas.guardar(
        new JefeDepartamento({
          id: idJefe,
          nombre: `Jefe ${p + 1}`,
          correo: `${idJefe.toLowerCase()}@ejemplo.invalid`,
          contrasenaHash: 'x',
          programa,
        }),
      );
      for (const idCurso of datos.cursos) {
        const curso = new Curso({
          idCurso,
          nombre: `Asignatura ${idCurso}`,
          periodo: PERIODO,
          ultimaSincronizacion: null,
          estudiantes: [],
        });
        const idDocente = CONF.docentesPorCurso(idCurso);
        docentes.set(idDocente, [...(docentes.get(idDocente) ?? []), curso]);
      }
    }
    for (const [id, cursos] of docentes) {
      await repos.personas.guardar(
        new Docente({
          id,
          nombre: `Docente ${id}`,
          correo: `${id.toLowerCase()}@ejemplo.invalid`,
          contrasenaHash: 'x',
          cursos,
        }),
      );
    }
    for (let p = 0; p < CONF.psicologos; p++) {
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
    }
  }

  const configuracionApp = new ConfigService(
    validarEntorno({
      ...process.env,
      BD_DETECTA_NOMBRE: BASE_CARGA,
      BD_INSTITUCIONAL_NOMBRE: BASE_INSTITUCIONAL_CARGA,
    }),
  );
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(configuracionApp)
    .overrideProvider(RELOJ)
    .useValue(() => new Date(AHORA))
    // Las mediciones no deben chocar con el limitador (ajuste A: se sustituye
    // por módulo en pruebas); con el reloj congelado y sin fallos no bloquea.
    .overrideProvider(LIMITADORES)
    .useValue(crearLimitadores(() => new Date(AHORA)))
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  jwt = app.get(JwtService);
  if (reutilizar) {
    await cargarIds();
  }
}, 900_000);

afterAll(async () => {
  await app?.close();
  await lector?.destroy();
  await fuente?.destroy();
});

describe(`Mediciones de B9 (escenario ${ESCENARIO})`, () => {
  it('M3: sincronización (un curso; sincronizarTodo)', async () => {
    if (ids.estudiantes.length > 0) {
      reportar('M3', { omitida: 'datos reutilizados' });
      return;
    }
    const servicio = new ServicioSincronizacion(
      crearConector(lector, repos),
      new UnidadTrabajoPersistente(fuente),
      repos.cursos,
      () => AHORA,
    );
    const primerCurso = CONF.programas[0]!.cursos[0]!;
    const curso = await medir(() => servicio.sincronizarCurso(primerCurso));
    const todoNuevos = await medir(() => servicio.sincronizarTodo());
    const todoExistentes = await medir(() => servicio.sincronizarTodo());
    reportar('M3', {
      cursoPrimeraVez: {
        idCurso: primerCurso,
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
  }, 900_000);

  it('Datos: 6000 alertas y casos, 1000 planes, 400 casos psicológicos con cita', async () => {
    if (ids.estudiantes.length > 0) {
      return;
    }
    const inicio = performance.now();
    const registros = await repos.registros.listar(new Map());
    const docentes = new Map<string, Docente>();
    for (const fila of await fuente.query<{ id: string }[]>(
      `SELECT id FROM persona WHERE rol = 'DOCENTE'`,
    )) {
      docentes.set(
        fila.id,
        (await repos.personas.buscarPorId(fila.id)) as Docente,
      );
    }
    const jefes = new Map<string, JefeDepartamento>();
    for (const fila of await fuente.query<{ id: string }[]>(
      `SELECT id FROM persona WHERE rol = 'JEFE_DEPARTAMENTO'`,
    )) {
      const jefe = (await repos.personas.buscarPorId(
        fila.id,
      )) as JefeDepartamento;
      jefes.set(jefe.programa.idPrograma, jefe);
    }
    const cerrados: string[] = [];
    let planes = 0;
    for (let i = 0; i < 6000; i++) {
      const registro = registros[i % registros.length]!;
      const alerta = docentes
        .get(CONF.docentesPorCurso(registro.curso.idCurso))!
        .emitirAlerta(registro, NivelRiesgo.MEDIO, 'Alerta sintética');
      const caso = alerta.generarCasoRiesgo();
      await repos.alertas.guardar(alerta);
      if (i % 6 === 1) {
        caso.canalizar(RutaAtencion.ACADEMICA);
      }
      await repos.casos.guardar(caso);
      if (i % 6 === 1) {
        const jefe = jefes.get(
          registro.estudiante.obtenerPrograma().idPrograma,
        )!;
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
    const estudiantes = await fuente.query<{ id: string }[]>(
      `SELECT id FROM persona WHERE rol = 'ESTUDIANTE' ORDER BY id`,
    );
    const psicologos: Psicologo[] = [];
    for (let p = 0; p < CONF.psicologos; p++) {
      psicologos.push(
        (await repos.personas.buscarPorId(`PS-C${p + 1}`)) as Psicologo,
      );
    }
    for (let i = 0; i < 400; i++) {
      const estudiante = (await repos.personas.buscarPorId(
        estudiantes[i]!.id,
      )) as Estudiante;
      const caso: CasoRiesgo = estudiante
        .solicitarAcompanamiento(
          RutaAtencion.PSICOLOGICA,
          'Solicitud sintética',
          'Lunes',
        )
        .generarCasoRiesgo();
      await repos.solicitudes.guardar(caso.origen as never);
      caso.asignarPsicologo(psicologos[CONF.psicologoDe(i)]!);
      caso.aprobar();
      caso.programarCita(
        new Date(Date.UTC(2026, 11, 1) + i * 3_600_000),
        Modalidad.VIRTUAL,
      );
      await repos.casos.guardar(caso);
    }
    await cargarIds();
    reportar('DATOS', {
      estudiantes: ids.estudiantes.length,
      docentes: ids.docentes.length,
      jefes: ids.jefes.length,
      psicologos: ids.psicologos.length,
      registros: registros.length,
      alertasYCasos: 6000,
      cerradosOArchivados: cerrados.length,
      planes,
      casosPsicologicos: 400,
      casosDelPrimerPsicologo: ids.casosPsicologo0.length,
      segundos: Math.round((performance.now() - inicio) / 1000),
    });
  }, 1_800_000);

  it('M8: consultas por guardar(caso)', async () => {
    const [sinCita] = await fuente.query<{ id_caso: string }[]>(
      `SELECT id_caso FROM caso_riesgo WHERE ruta IS NULL LIMIT 1`,
    );
    const caso = await repos.casos.buscarPorId(sinCita!.id_caso);
    const conCita = await repos.casos.buscarPorId(ids.casosPsicologo0[0]!);
    const a = await medir(() => repos.casos.guardar(caso!));
    const b = await medir(() => repos.casos.guardar(conCita!));
    reportar('M8', { casoSinCitas: a.consultas, casoConUnaCita: b.consultas });
  });

  it('M2: guard (buscarPorId de la sesión) por rol, 3 repeticiones de 20', async () => {
    const roles: [string, string][] = [
      ['ESTUDIANTE', ids.estudiantes[0]!],
      ['DOCENTE', ids.docentes[0]!],
      ['JEFE', ids.jefes[0]!],
      ['PSICOLOGO', ids.psicologos[0]!],
    ];
    const resultados: Record<string, unknown> = {};
    for (const [rol, id] of roles) {
      const cookie = await cookieDe(id);
      const p50Repo: number[] = [];
      const p95Http: number[] = [];
      let consultas = 0;
      for (let r = 0; r < REPETICIONES; r++) {
        const repo: number[] = [];
        const http: number[] = [];
        for (let i = 0; i < 20; i++) {
          const m = await medir(() => repos.personas.buscarPorId(id));
          repo.push(m.ms);
          consultas = m.consultas;
          http.push((await pedir('GET', '/acceso/sesion', cookie)).ms);
        }
        p50Repo.push(estadistica(repo).p50);
        p95Http.push(estadistica(http).p95);
      }
      resultados[rol] = {
        consultasGuard: consultas,
        buscarPorIdP50Ms: resumen(p50Repo),
        getSesionP95Ms: resumen(p95Http),
      };
    }
    reportar('M2', resultados);
  });

  it('M1: inicio de sesión con bcrypt (costo del entorno), 3 repeticiones', async () => {
    const costo = Number(process.env['BCRYPT_COSTO'] ?? 12);
    const hash = await hashContrasenas.generar(CONTRASENA, costo);
    await fuente.query(
      `UPDATE persona SET contrasena_hash = $1 WHERE rol = 'ESTUDIANTE'`,
      [hash],
    );
    const correos = (
      await fuente.query<{ correo: string }[]>(
        `SELECT correo FROM persona WHERE id = ANY($1)`,
        [ids.estudiantes.slice(0, 200)],
      )
    ).map((f) => f.correo);
    const iniciar = (i: number) =>
      pedir('POST', '/acceso/iniciar-sesion', null, {
        correo: correos[i % correos.length],
        contrasena: CONTRASENA,
      });
    const serie: number[] = [];
    const c20: number[] = [];
    for (let r = 0; r < REPETICIONES; r++) {
      const tiempos: number[] = [];
      for (let i = 0; i < 20; i++) {
        tiempos.push((await iniciar(i)).ms);
      }
      serie.push(estadistica(tiempos).p95);
      const lote = await Promise.all(
        Array.from({ length: 20 }, (_, i) => iniciar(i)),
      );
      expect(lote.every((x) => x.estado === 200)).toBe(true);
      c20.push(estadistica(lote.map((x) => x.ms)).p95);
    }
    const lote200 = await Promise.all(
      Array.from({ length: 200 }, (_, i) => iniciar(i)),
    );
    reportar('M1', {
      costoBcrypt: costo,
      uvThreadpoolSize: process.env['UV_THREADPOOL_SIZE'] ?? '4 (por defecto)',
      enSerieP95Ms: resumen(serie),
      concurrentes20P95Ms: resumen(c20),
      concurrentes200Informativo: {
        ...estadistica(lote200.map((x) => x.ms)),
        exitosos: lote200.filter((x) => x.estado === 200).length,
      },
    });
  });

  it('M5: informe de una asignatura, 10 repeticiones', async () => {
    const idJefe = ids.jefes[0]!;
    const jefe = (await repos.personas.buscarPorId(idJefe)) as JefeDepartamento;
    const programa = CONF.programas.find(
      (p) => p.id === jefe.programa.idPrograma,
    )!;
    const cookie = await cookieDe(idJefe);
    const http: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await pedir('POST', '/informes', cookie, {
        periodo: PERIODO,
        idCurso: programa.cursos[0],
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
    const curso = await repos.cursos.buscarPorId(programa.cursos[0]!);
    const m = await medir(() =>
      generador.generar(PERIODO, programa.id, curso!, jefe),
    );
    reportar('M5', {
      postInformesMs: estadistica(http),
      consultas: m.consultas,
      totales: {
        alertas: m.resultado?.totalAlertas,
        casos: m.resultado?.totalCasos,
        planes: m.resultado?.totalPlanes,
      },
    });
  });

  it('M6: listarPorRol(PSICOLOGO)', async () => {
    const tiempos: number[] = [];
    let consultas = 0;
    for (let i = 0; i < 10; i++) {
      const m = await medir(() => repos.personas.listarPorRol(Rol.PSICOLOGO));
      tiempos.push(m.ms);
      consultas = m.consultas;
    }
    reportar('M6', {
      psicologos: ids.psicologos.length,
      ms: estadistica(tiempos),
      consultas,
    });
  });

  it('M7: reprogramarCita (carga de los casos del psicólogo)', async () => {
    const tiempos: number[] = [];
    let consultas = 0;
    for (let i = 0; i < 10; i++) {
      const m = await medir(() =>
        repos.casos.listarPorPsicologo(ids.psicologos[0]!),
      );
      tiempos.push(m.ms);
      consultas = m.consultas;
    }
    const cookie = await cookieDe(ids.psicologos[0]!);
    const caso = await repos.casos.buscarPorId(ids.casosPsicologo0[0]!);
    const idCita = caso!.citas[0]!.idCita;
    const http: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await pedir(
        'POST',
        `/atencion/citas/${idCita}/reprogramacion`,
        cookie,
        {
          fechaHora: new Date(
            Date.UTC(2027, 0, 1 + i, 15) + Math.random() * 3_600_000,
          ).toISOString(),
          modalidad: 'VIRTUAL',
        },
      );
      http.push(r.ms);
    }
    reportar('M7', {
      casosDelPsicologo: ids.casosPsicologo0.length,
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
        'alertasEmitidas',
        'GET',
        `/alertas/emitidas?periodo=${PERIODO}`,
        ids.docentes[0]!,
      ],
      ['bandejaJefe', 'GET', '/casos/pendientes', ids.jefes[0]!],
      ['bandejaPsicologo', 'GET', '/atencion/casos', ids.psicologos[0]!],
    ];
    const resultados: Record<string, unknown> = {};
    for (const [tipo, metodo, ruta, id, cuerpo] of casos) {
      const cookie = await cookieDe(id);
      const p95: number[] = [];
      let ultimo = { estado: 0, bytes: 0 };
      for (let r = 0; r < REPETICIONES; r++) {
        const tiempos: number[] = [];
        for (let i = 0; i < 5; i++) {
          const x = await pedir(metodo, ruta, cookie, cuerpo);
          tiempos.push(x.ms);
          ultimo = x;
        }
        p95.push(estadistica(tiempos).p95);
      }
      resultados[tipo] = {
        p95Ms: resumen(p95),
        estado: ultimo.estado,
        kB: Math.round(ultimo.bytes / 1024),
      };
    }
    const [pendientes] = await fuente.query<{ total: string }[]>(
      `SELECT count(*) AS total FROM caso_riesgo c JOIN persona e ON e.id = c.id_estudiante
       JOIN persona j ON j.id_programa_dirigido = e.id_programa WHERE j.id = $1 AND c.estado = 'PENDIENTE' AND c.ruta IS NULL`,
      [ids.jefes[0]],
    );
    reportar('M4-individual', {
      pendientesBandejaJefe: Number(pendientes?.total),
      ...resultados,
    });
  });

  it('M4: 200 usuarios virtuales con tiempo de reflexión (10 s y 5 s), con sincronización en curso; ráfaga informativa', async () => {
    type PoolPg = {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
      options: { max: number };
    };
    const pool = (app.get(DataSource).driver as unknown as { master: PoolPg })
      .master;
    const servidor = app.getHttpServer() as Server;
    const cookies = {
      estudiantes: await Promise.all(
        ids.estudiantes.slice(0, 150).map(cookieDe),
      ),
      docentes: await Promise.all(ids.docentes.slice(0, 30).map(cookieDe)),
      jefes: await Promise.all(ids.jefes.map(cookieDe)),
      psicologos: await Promise.all(ids.psicologos.map(cookieDe)),
    };
    // Supuestos del escenario (NO son cifras del ER): 150 estudiantes, 30
    // docentes, 17 jefes y 3 psicólogos activos; cada usuario hace una petición
    // y espera el tiempo de reflexión (±50 %) antes de la siguiente.
    type Peticion = {
      tipo: string;
      hacer: () => Promise<{ estado: number; ms: number }>;
    };
    function siguiente(usuario: number, vuelta: number): Peticion {
      if (usuario < 150) {
        const cookie = cookies.estudiantes[usuario]!;
        if (vuelta % 10 === 9 && usuario % 15 === 0) {
          return {
            tipo: 'radicarSolicitud',
            hacer: () =>
              pedir('POST', '/solicitudes', cookie, {
                tipoApoyo: 'ACADEMICA',
                motivo: 'Solicitud de carga',
              }),
          };
        }
        return vuelta % 2 === 0
          ? {
              tipo: 'consultaRegistros',
              hacer: () =>
                pedir('GET', `/consulta/registros?periodo=${PERIODO}`, cookie),
            }
          : {
              tipo: 'consultaAlertas',
              hacer: () =>
                pedir('GET', `/consulta/alertas?periodo=${PERIODO}`, cookie),
            };
      }
      if (usuario < 180) {
        const cookie =
          cookies.docentes[(usuario - 150) % cookies.docentes.length]!;
        return {
          tipo: 'alertasEmitidas',
          hacer: () =>
            pedir('GET', `/alertas/emitidas?periodo=${PERIODO}`, cookie),
        };
      }
      if (usuario < 197) {
        const cookie = cookies.jefes[(usuario - 180) % cookies.jefes.length]!;
        return {
          tipo: 'bandejaJefe',
          hacer: () => pedir('GET', '/casos/pendientes', cookie),
        };
      }
      const cookie =
        cookies.psicologos[(usuario - 197) % cookies.psicologos.length]!;
      return {
        tipo: 'bandejaPsicologo',
        hacer: () => pedir('GET', '/atencion/casos', cookie),
      };
    }

    async function ronda(reflexionMs: number, duracionMs: number) {
      const retraso = monitorEventLoopDelay({ resolution: 10 });
      retraso.enable();
      let esperaMaxima = 0;
      const muestreo = setInterval(() => {
        esperaMaxima = Math.max(esperaMaxima, pool.waitingCount);
      }, 50);
      erroresDeRed.clear();
      // Sincronización en curso durante la ronda (ER 3.4.1 b; ajuste C).
      const sincronizacion = app.get(ServicioSincronizacion);
      const inicioSync = performance.now();
      const sync = sincronizacion.sincronizarTodo().then(
        () => Math.round(performance.now() - inicioSync),
        () => -1,
      );
      const resultados: { tipo: string; estado: number; ms: number }[] = [];
      const fin = performance.now() + duracionMs;
      await Promise.all(
        Array.from({ length: 200 }, async (_, usuario) => {
          // Arranque escalonado para no sincronizar a todos los usuarios.
          await new Promise((resolver) =>
            setTimeout(resolver, Math.random() * reflexionMs),
          );
          for (let vuelta = 0; performance.now() < fin; vuelta++) {
            const p = siguiente(usuario, vuelta);
            resultados.push({ tipo: p.tipo, ...(await p.hacer()) });
            await new Promise((resolver) =>
              setTimeout(resolver, reflexionMs * (0.5 + Math.random())),
            );
          }
        }),
      );
      clearInterval(muestreo);
      retraso.disable();
      const porTipo: Record<string, unknown> = {};
      for (const tipo of new Set(resultados.map((r) => r.tipo))) {
        const deTipo = resultados.filter((r) => r.tipo === tipo);
        porTipo[tipo] = {
          ...estadistica(deTipo.map((r) => r.ms)),
          errores: deTipo.filter((r) => r.estado === 0 || r.estado >= 500)
            .length,
        };
      }
      return {
        peticiones: resultados.length,
        porSegundo: Math.round(resultados.length / (duracionMs / 1000)),
        todas: estadistica(resultados.map((r) => r.ms)),
        porTipo,
        diagnostico: {
          eventLoopRetrasoMs: {
            p99: Math.round(retraso.percentile(99) / 1e6),
            max: Math.round(retraso.max / 1e6),
          },
          pool: { max: pool.options.max, esperandoConexionMax: esperaMaxima },
          erroresDeRed: Object.fromEntries(erroresDeRed),
        },
        sincronizarTodoMs: await sync,
      };
    }

    reportar('M4-servidor', {
      keepAliveTimeoutMs: servidor.keepAliveTimeout,
      headersTimeoutMs: servidor.headersTimeout,
      requestTimeoutMs: servidor.requestTimeout,
    });
    for (const reflexion of [10_000, 5_000]) {
      const rondas = [];
      for (let r = 0; r < REPETICIONES; r++) {
        rondas.push(await ronda(reflexion, 60_000));
      }
      reportar(`M4-reflexion-${reflexion / 1000}s`, {
        p95TodasMs: resumen(rondas.map((x) => x.todas.p95)),
        rondas,
      });
    }
    // Ráfaga informativa: 200 peticiones a la vez, sin reflexión.
    const rafaga = await Promise.all(
      Array.from({ length: 200 }, async (_, usuario) => {
        const p = siguiente(usuario, 0);
        return { tipo: p.tipo, ...(await p.hacer()) };
      }),
    );
    reportar('M4-rafaga-informativa', {
      todas: estadistica(rafaga.map((r) => r.ms)),
      errores: rafaga.filter((r) => r.estado === 0).length,
    });
  }, 3_600_000);
});
