import { writeFileSync } from 'node:fs';
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
import type { InformeDto } from '../src/controladores/controlador-informes';
import type { PlanDto } from '../src/controladores/respuestas-casos';
import { Curso } from '../src/dominio/entidades/curso';
import { Docente } from '../src/dominio/entidades/docente';
import { RegistroAcademico } from '../src/dominio/entidades/registro-academico';
import { RutaAtencion } from '../src/dominio/entidades/ruta-atencion';
import { validarEntorno } from '../src/validacion-entorno';
import {
  casoDeAlerta,
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
  estudiante,
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
 * Plan de nivelación (B8a) e informes de riesgo (B8b) por HTTP real contra
 * detecta_pruebas, con un doble de ProveedorCorreo y reloj fijo.
 */

const CONTRASENA = 'Contraseña-de-prueba-1';
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
  plan?: PlanDto;
};

interface Respuesta<T> {
  estado: number;
  cuerpo: T;
  cabeceras: Headers;
  bytes: Buffer;
}

let app: INestApplication;
let url: string;
let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
const correo = new ProveedorCorreoEnMemoria();
const sesiones = new Map<string, string>();
const tiempos: Record<string, number[]> = { informe: [], exportacion: [] };

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
  const bytes = Buffer.from(await respuesta.arrayBuffer());
  if (medir) {
    tiempos[medir]?.push(performance.now() - inicio);
  }
  const esJson = (respuesta.headers.get('content-type') ?? '').includes('json');
  return {
    estado: respuesta.status,
    cuerpo: (esJson && bytes.length > 0
      ? JSON.parse(bytes.toString('utf8'))
      : null) as T,
    cabeceras: respuesta.headers,
    bytes,
  };
}

async function esperarCorreos(): Promise<void> {
  await app.get(ServicioNotificacion).onApplicationShutdown();
}

/** Caso académico de E1 canalizado a la ruta académica por el Jefe. */
async function casoAcademico(): Promise<string> {
  const { caso } = await casoDeSolicitud(repos, esc.e1, RutaAtencion.ACADEMICA);
  caso.canalizar(RutaAtencion.ACADEMICA);
  await repos.casos.guardar(caso);
  return caso.idCaso;
}

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
  esc = await crearEscenario(repos);
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
    Object.entries(tiempos)
      .filter(([, valores]) => valores.length > 0)
      .map(([clave, valores]) => [
        clave,
        {
          n: valores.length,
          maxMs: Math.round(Math.max(...valores)),
          medianaMs: Math.round(
            [...valores].sort((a, b) => a - b)[
              Math.floor(valores.length / 2)
            ] ?? 0,
          ),
        },
      ]),
  );
  process.stdout.write(`TIEMPOS_B8 ${JSON.stringify(resumen)}\n`);
});

/** Eventos de trazabilidad del plan (B9; ER 1.3.4, CUD04). */
async function eventosDelPlan(idPlan: string) {
  return fuente.query<{ tipo: string; id_caso: string; id_actor: string }[]>(
    'SELECT tipo, id_caso, id_actor FROM evento_caso WHERE id_plan = $1',
    [idPlan],
  );
}

describe('B8a: plan de nivelación (R04, CUD05)', () => {
  it('estructura el plan sobre el caso EN_NIVELACION, notifica al estudiante y lo finaliza; el caso sigue EN_NIVELACION', async () => {
    const idCaso = await casoAcademico();
    correo.enviados.length = 0;
    const registro = await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
      idCaso,
      idsCursos: ['C1'],
      tutorNombre: 'Tutor Uno',
      tutorCodigo: 'T-001',
    });
    expect(registro.estado).toBe(201);
    expect(registro.cuerpo.mensaje).toBe('Plan de nivelación registrado');
    await esperarCorreos();
    expect(correo.enviados.map((c) => [c.destino, c.asunto])).toEqual([
      ['e1@ejemplo.edu.co', 'DETECTA: plan de nivelación académica'],
    ]);
    expect(correo.enviados[0]?.cuerpo).not.toMatch(/Cálculo|Tutor Uno|T-001/);

    const idPlan = registro.cuerpo.plan?.idPlan ?? '';
    const fin = await pedir<{ plan: PlanDto }>(
      'j1@ejemplo.edu.co',
      'POST',
      `/planes/${idPlan}/finalizacion`,
    );
    expect(fin.estado).toBe(200);
    expect(fin.cuerpo.plan.estado).toBe('FINALIZADO');
    const [fila] = await fuente.query<{ estado: string }[]>(
      'SELECT estado FROM caso_riesgo WHERE id_caso = $1',
      [idCaso],
    );
    expect(fila?.estado).toBe('EN_NIVELACION');
    expect(
      await pedir(
        'j1@ejemplo.edu.co',
        'POST',
        `/planes/${idPlan}/finalizacion`,
      ),
    ).toMatchObject({
      estado: 409,
      cuerpo: { message: 'El plan de nivelación ya está finalizado' },
    });
    // B9, trazabilidad: un solo evento, con el Jefe como autor.
    expect(await eventosDelPlan(idPlan)).toEqual([
      { tipo: 'PLAN_FINALIZADO', id_caso: idCaso, id_actor: 'J1' },
    ]);
  });

  it('dos sesiones finalizan el mismo plan a la vez: una lo finaliza y la otra recibe 409', async () => {
    const idCaso = await casoAcademico();
    const registro = await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
      idCaso,
      idsCursos: ['C1', 'C0'],
      tutorNombre: 'Tutor',
      tutorCodigo: 'T2',
    });
    const idPlan = registro.cuerpo.plan?.idPlan ?? '';
    const [a, b] = await Promise.all([
      pedir('j1@ejemplo.edu.co', 'POST', `/planes/${idPlan}/finalizacion`),
      pedir('j1@ejemplo.edu.co', 'POST', `/planes/${idPlan}/finalizacion`),
    ]);
    expect([a.estado, b.estado].sort((x, y) => x - y)).toEqual([200, 409]);
    expect(await eventosDelPlan(idPlan)).toHaveLength(1);
  });

  it('validaciones: tutor, cursos sin registro del estudiante, caso de otra ruta o de otro programa', async () => {
    const idCaso = await casoAcademico();
    expect(
      await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
        idCaso,
        idsCursos: ['C1'],
        tutorNombre: 'Tutor',
        tutorCodigo: ' ',
      }),
    ).toMatchObject({
      estado: 400,
      cuerpo: { message: 'Faltan los datos del estudiante tutor' },
    });
    // E1 no tiene registro en un curso que no existe ni en C9; C1 y C0 sí.
    expect(
      (
        await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
          idCaso,
          idsCursos: ['C9'],
          tutorNombre: 'T',
          tutorCodigo: 'T',
        })
      ).estado,
    ).toBe(400);
    const alerta = await casoDeAlerta(repos, esc.d1, esc.r1);
    alerta.caso.canalizar(RutaAtencion.PSICOLOGICA);
    await repos.casos.guardar(alerta.caso);
    expect(
      (
        await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
          idCaso: alerta.caso.idCaso,
          idsCursos: ['C1'],
          tutorNombre: 'T',
          tutorCodigo: 'T',
        })
      ).estado,
    ).toBe(409);
    const ajeno = await casoDeAlerta(repos, esc.d1, esc.r3); // E3 cursa P2
    expect(
      (
        await pedir('j1@ejemplo.edu.co', 'POST', '/planes', {
          idCaso: ajeno.caso.idCaso,
          idsCursos: ['C1'],
          tutorNombre: 'T',
          tutorCodigo: 'T',
        })
      ).estado,
    ).toBe(403);
    expect(
      (
        await pedir('ps1@ejemplo.edu.co', 'POST', '/planes', {
          idCaso,
          idsCursos: ['C1'],
          tutorNombre: 'T',
          tutorCodigo: 'T',
        })
      ).estado,
    ).toBe(403);
  });
});

describe('B8b: informes de riesgo por asignatura (R07, CUD10)', () => {
  it('el Jefe genera el informe de su programa; lo exporta en PDF con nombre fijo y solo datos agregados', async () => {
    const respuesta = await pedir<{ informe: InformeDto }>(
      'j1@ejemplo.edu.co',
      'POST',
      '/informes',
      {
        periodo: PERIODO,
        idCurso: 'C1',
      },
      'informe',
    );
    expect(respuesta.estado).toBe(201);
    expect(respuesta.cuerpo.informe).toMatchObject({
      idPrograma: 'P1',
      periodo: PERIODO,
      curso: { idCurso: 'C1' },
    });
    expect(respuesta.cuerpo.informe.totalPlanes).toBeGreaterThan(0);

    const pdf = await pedir(
      'j1@ejemplo.edu.co',
      'GET',
      `/informes/${respuesta.cuerpo.informe.idInforme}/pdf`,
      undefined,
      'exportacion',
    );
    expect(pdf.estado).toBe(200);
    expect(pdf.cabeceras.get('content-type')).toBe('application/pdf');
    expect(pdf.cabeceras.get('content-disposition')).toBe(
      'attachment; filename="informe-riesgo.pdf"',
    );
    // B9 (ajuste E): el PDF no se guarda en caché y lleva las cabeceras de seguridad.
    expect(pdf.cabeceras.get('cache-control')).toBe('no-store');
    expect(pdf.cabeceras.get('x-content-type-options')).toBe('nosniff');
    const texto = pdf.bytes.toString('latin1');
    expect(texto.startsWith('%PDF-1.4')).toBe(true);
    expect(texto.endsWith('%%EOF\n')).toBe(true);
    expect(texto).toContain('solo los casos cerrados o archivados');
    expect(texto).not.toMatch(
      /Estudiante E1|e1@ejemplo|Necesito apoyo|Bajo rendimiento|Tutor Uno/,
    );
    // Copia local para que Ivan lo abra en un lector (fuera del repositorio).
    if (process.env['DETECTA_PDF_MUESTRA']) {
      writeFileSync(process.env['DETECTA_PDF_MUESTRA'], pdf.bytes);
    }
  });

  it('el Psicólogo indica el programa (obligatorio) y exporta cualquier informe; el Jefe no exporta el de otro programa', async () => {
    const otro = await casoDeAlerta(repos, esc.d1, esc.r3); // E3 cursa P2
    void otro;
    const delPsicologo = await pedir<{ informe: InformeDto }>(
      'ps1@ejemplo.edu.co',
      'POST',
      '/informes',
      {
        periodo: PERIODO,
        idPrograma: 'P2',
        idCurso: 'C1',
      },
    );
    expect(delPsicologo.estado).toBe(201);
    expect(delPsicologo.cuerpo.informe.idPrograma).toBe('P2');
    const id = delPsicologo.cuerpo.informe.idInforme;
    expect(
      (await pedir('ps1@ejemplo.edu.co', 'GET', `/informes/${id}/pdf`)).estado,
    ).toBe(200);
    expect(
      (await pedir('j1@ejemplo.edu.co', 'GET', `/informes/${id}/pdf`)).estado,
    ).toBe(403);
    expect(
      await pedir('ps1@ejemplo.edu.co', 'POST', '/informes', {
        periodo: PERIODO,
        idCurso: 'C1',
      }),
    ).toMatchObject({
      estado: 400,
      cuerpo: { message: 'La solicitud no es válida.' },
    });
    expect(
      await pedir('j1@ejemplo.edu.co', 'POST', '/informes', {
        periodo: PERIODO,
        idPrograma: 'P2',
        idCurso: 'C1',
      }),
    ).toMatchObject({
      estado: 400,
      cuerpo: { message: 'La solicitud no es válida.' },
    });
  });

  it('periodo sin datos: 200 con el mensaje de sd_CUD10 y nada guardado', async () => {
    const [antes] = await fuente.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM informe_riesgo',
    );
    const respuesta = await pedir('j1@ejemplo.edu.co', 'POST', '/informes', {
      periodo: '1999-1',
      idCurso: 'C1',
    });
    expect(respuesta).toMatchObject({
      estado: 200,
      cuerpo: { mensaje: 'No hay datos para el periodo seleccionado' },
    });
    const [despues] = await fuente.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM informe_riesgo',
    );
    expect(despues?.total).toBe(antes?.total);
  });

  it('rendimiento: curso de 60 estudiantes con unas 200 alertas, casos y planes; el informe se genera en menos de 5 s (ER 3.4.2)', async () => {
    const curso = new Curso({
      idCurso: 'C7',
      nombre: 'Estructuras de datos',
      periodo: PERIODO,
      ultimaSincronizacion: null,
      estudiantes: [],
    });
    const docente = new Docente({
      id: 'D7',
      nombre: 'Docente Siete',
      correo: 'd7@ejemplo.edu.co',
      contrasenaHash: 'x',
      cursos: [curso],
    });
    await repos.personas.guardar(docente);
    const registros: RegistroAcademico[] = [];
    for (let i = 0; i < 60; i++) {
      const alumno = estudiante(`EP${i}`, esc.p1);
      await repos.personas.guardar(alumno);
      const registro = new RegistroAcademico({
        idRegistro: `RP${i}`,
        nota: 2,
        porcentajeAsistencia: 50,
        estudiante: alumno,
        curso,
      });
      await repos.registros.guardar(registro);
      registros.push(registro);
    }
    let planes = 0;
    for (let i = 0; i < 200; i++) {
      const { caso } = await casoDeAlerta(
        repos,
        docente,
        registros[i % 60]!,
        'Alerta de carga',
      );
      if (i % 2 === 0) {
        await fuente.query(
          `UPDATE caso_riesgo SET estado = $2 WHERE id_caso = $1`,
          [caso.idCaso, i % 4 === 0 ? 'CERRADO' : 'ARCHIVADO'],
        );
      } else {
        caso.canalizar(RutaAtencion.ACADEMICA);
        await repos.casos.guardar(caso);
        for (let k = 0; k < 2; k++) {
          await repos.planes.guardar(
            esc.j1.estructurarPlanNivelacion(caso, [curso], 'Tutor', 'T', ''),
          );
          planes += 1;
        }
      }
    }
    for (let i = 0; i < 3; i++) {
      const respuesta = await pedir<{ informe: InformeDto }>(
        'j1@ejemplo.edu.co',
        'POST',
        '/informes',
        { periodo: PERIODO, idCurso: 'C7' },
        'informe',
      );
      expect(respuesta.estado).toBe(201);
      expect(respuesta.cuerpo.informe).toMatchObject({
        totalAlertas: 200,
        totalCasos: 100,
        totalPlanes: planes,
      });
      await pedir(
        'j1@ejemplo.edu.co',
        'GET',
        `/informes/${respuesta.cuerpo.informe.idInforme}/pdf`,
        undefined,
        'exportacion',
      );
    }
    expect(Math.max(...(tiempos['informe'] ?? [Infinity]))).toBeLessThan(5000);
  }, 300_000);
});
