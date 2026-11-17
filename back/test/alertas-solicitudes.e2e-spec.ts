import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import {
  PROVEEDOR_CORREO,
  type ProveedorCorreo,
} from '../src/aplicacion/contratos/proveedor-correo';
import { hashContrasenas } from '../src/aplicacion/servicios/hash-contrasenas';
import { ServicioNotificacion } from '../src/aplicacion/servicios/servicio-notificacion';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import { Curso } from '../src/dominio/entidades/curso';
import { Docente } from '../src/dominio/entidades/docente';
import { RutaAtencion } from '../src/dominio/entidades/ruta-atencion';
import type {
  AlertaEmitidaDto,
  AlertaEstudianteDto,
  SolicitudDto,
} from '../src/controladores/respuestas';
import { validarEntorno } from '../src/validacion-entorno';
import {
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
 * Flujos completos del docente y del estudiante (criterio de cierre de B6),
 * por HTTP real contra detecta_pruebas, con un doble de ProveedorCorreo que
 * captura los correos. Mide los tiempos de consulta (< 2 s, ER 3.4.2) y de
 * radicación (< 3 s, CUD02) en este escenario.
 */

const CONTRASENA = 'Contraseña-de-prueba-1';

class ProveedorCorreoEnMemoria implements ProveedorCorreo {
  readonly enviados: { destino: string; asunto: string; cuerpo: string }[] = [];
  enviar(destino: string, asunto: string, cuerpo: string): Promise<boolean> {
    this.enviados.push({ destino, asunto, cuerpo });
    return Promise.resolve(true);
  }
}

let app: INestApplication;
let url: string;
let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
const correo = new ProveedorCorreoEnMemoria();
const tiempos: Record<string, number[]> = {
  consulta: [],
  radicacion: [],
  emision: [],
};
const sesiones = new Map<string, string>();

async function sesion(correoUsuario: string): Promise<string> {
  const guardada = sesiones.get(correoUsuario);
  if (guardada) {
    return guardada;
  }
  const respuesta = await fetch(`${url}/acceso/iniciar-sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correoUsuario, contrasena: CONTRASENA }),
  });
  expect(respuesta.status).toBe(200);
  const cookie =
    respuesta.headers
      .getSetCookie()
      .find((valor) => valor.startsWith('detecta_sesion='))
      ?.split(';')[0] ?? '';
  sesiones.set(correoUsuario, cookie);
  return cookie;
}

/** Lectura laxa de los cuerpos que no son listas. */
type CuerpoGeneral = Partial<SolicitudDto> & {
  message?: string;
  mensaje?: string;
  curso?: unknown;
  registros?: { idRegistro: string }[];
  alerta?: AlertaEmitidaDto;
};

interface Respuesta<T> {
  estado: number;
  cuerpo: T;
}

async function pedir<T = CuerpoGeneral>(
  usuario: string | null,
  metodo: 'GET' | 'POST',
  ruta: string,
  cuerpo?: unknown,
  medir?: keyof typeof tiempos,
): Promise<Respuesta<T>> {
  const cabeceras: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (usuario !== null) {
    cabeceras['Cookie'] = await sesion(usuario);
  }
  const inicio = performance.now();
  const respuesta = await fetch(`${url}${ruta}`, {
    method: metodo,
    headers: cabeceras,
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

/** Espera determinista de los correos lanzados sin esperar (respuesta 6). */
async function esperarCorreos(): Promise<void> {
  await app.get(ServicioNotificacion).onApplicationShutdown();
}

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
  esc = await crearEscenario(repos);
  // E4: estudiante sin registros académicos (D21). D2 dicta C5, ajeno a D1.
  await repos.personas.guardar(estudiante('E4', esc.p1));
  const c5 = new Curso({
    idCurso: 'C5',
    nombre: 'Física',
    periodo: PERIODO,
    ultimaSincronizacion: null,
    estudiantes: [],
  });
  await repos.personas.guardar(
    new Docente({
      id: 'D2',
      nombre: 'Docente Dos',
      correo: 'd2@ejemplo.edu.co',
      contrasenaHash: 'x',
      cursos: [c5],
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
  process.stdout.write(`TIEMPOS_B6 ${JSON.stringify(resumen)}\n`);
});

describe('Flujo completo del docente (R01, CUD03, CUD01)', () => {
  it('consulta su curso, emite la alerta, notifica a estudiante y jefe, y la ve en emitidas con su estado', async () => {
    const curso = await pedir(
      'd1@ejemplo.edu.co',
      'GET',
      '/alertas/cursos/C1',
      undefined,
      'consulta',
    );
    expect(curso.estado).toBe(200);
    expect(curso.cuerpo.curso).toMatchObject({
      idCurso: 'C1',
      nombre: 'Cálculo',
      periodo: PERIODO,
    });
    expect(
      (curso.cuerpo.registros ?? []).map((r) => r.idRegistro).sort(),
    ).toEqual(['R1', 'R2', 'R3']);
    expect(JSON.stringify(curso.cuerpo)).not.toMatch(/correo|contrasena|hash/i);

    correo.enviados.length = 0;
    const emision = await pedir(
      'd1@ejemplo.edu.co',
      'POST',
      '/alertas',
      {
        idRegistro: 'R1',
        nivelRiesgo: 'ALTO',
        descripcion: 'Inasistencias reiteradas y nota baja',
      },
      'emision',
    );
    expect(emision.estado).toBe(201);
    expect(emision.cuerpo.mensaje).toBe(
      'Alerta emitida y remitida al Jefe de Departamento',
    );
    const idAlerta = emision.cuerpo.alerta?.idAlerta ?? '';

    const [caso] = await fuente.query<
      {
        id_caso: string;
        ruta: string | null;
        estado: string;
        confidencialidad: boolean;
      }[]
    >(
      'SELECT id_caso, ruta, estado, confidencialidad FROM caso_riesgo WHERE id_origen = $1',
      [idAlerta],
    );
    expect(caso).toMatchObject({
      ruta: null,
      estado: 'PENDIENTE',
      confidencialidad: false,
    });

    await esperarCorreos();
    expect(
      correo.enviados
        .map((c) => [c.destino, c.asunto])
        .sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
    ).toEqual([
      ['e1@ejemplo.edu.co', 'DETECTA: nueva alerta académica'],
      ['j1@ejemplo.edu.co', 'DETECTA: caso remitido para su gestión'],
    ]);
    for (const enviado of correo.enviados) {
      expect(enviado.cuerpo).not.toContain('Inasistencias');
    }

    const emitidas = await pedir<AlertaEmitidaDto[]>(
      'd1@ejemplo.edu.co',
      'GET',
      `/alertas/emitidas?periodo=${PERIODO}`,
      undefined,
      'consulta',
    );
    expect(emitidas.estado).toBe(200);
    expect(emitidas.cuerpo.find((a) => a.idAlerta === idAlerta)).toMatchObject({
      estadoAtencion: 'PENDIENTE',
      curso: { idCurso: 'C1', nombre: 'Cálculo' },
      estudiante: { id: 'E1' },
    });

    // El Jefe canaliza (B7, simulado con el dominio): el docente ve ATENDIDA,
    // sin ruta ni avance.
    const casoGuardado = await repos.casos.buscarPorId(caso!.id_caso);
    casoGuardado!.canalizar(RutaAtencion.ACADEMICA);
    await repos.casos.guardar(casoGuardado!);
    const despues = await pedir<AlertaEmitidaDto[]>(
      'd1@ejemplo.edu.co',
      'GET',
      `/alertas/emitidas?periodo=${PERIODO}`,
    );
    const vista = despues.cuerpo.find((a) => a.idAlerta === idAlerta);
    expect(vista).toBeDefined();
    expect(vista?.estadoAtencion).toBe('ATENDIDA');
    expect(JSON.stringify(vista)).not.toMatch(/ACADEMICA|EN_NIVELACION|ruta/);
  });

  it('curso o registro ajenos o inexistentes: 403 con el mismo mensaje', async () => {
    for (const ruta of ['/alertas/cursos/C5', '/alertas/cursos/NO-EXISTE']) {
      expect(await pedir('d1@ejemplo.edu.co', 'GET', ruta)).toEqual({
        estado: 403,
        cuerpo: expect.objectContaining({
          message: 'El curso no está asignado al docente',
        }),
      });
    }
    for (const idRegistro of ['R1', 'NO-EXISTE']) {
      const respuesta = await pedir('d2@ejemplo.edu.co', 'POST', '/alertas', {
        idRegistro,
        nivelRiesgo: 'BAJO',
        descripcion: 'x',
      });
      expect(respuesta.estado).toBe(403);
      expect(respuesta.cuerpo.message).toBe(
        'El estudiante no pertenece a un curso asignado',
      );
    }
  });

  it('programa sin jefe (P2): la alerta se registra y solo se notifica al estudiante', async () => {
    correo.enviados.length = 0;
    const respuesta = await pedir('d1@ejemplo.edu.co', 'POST', '/alertas', {
      idRegistro: 'R3',
      nivelRiesgo: 'MEDIO',
      descripcion: 'Bajo rendimiento',
    });
    expect(respuesta.estado).toBe(201);
    expect(respuesta.cuerpo.mensaje).toBe(
      'Alerta emitida y remitida al Jefe de Departamento',
    );
    await esperarCorreos();
    expect(correo.enviados.map((c) => c.destino)).toEqual([
      'e3@ejemplo.edu.co',
    ]);
  });

  it('validación: campos vacíos, cuerpo inválido, longitud y periodo', async () => {
    const vacia = await pedir('d1@ejemplo.edu.co', 'POST', '/alertas', {
      idRegistro: 'R1',
      nivelRiesgo: 'ALTO',
      descripcion: ' ',
    });
    expect(vacia).toMatchObject({
      estado: 400,
      cuerpo: { message: 'Complete el nivel de riesgo y la justificación' },
    });
    const desconocido = await pedir('d1@ejemplo.edu.co', 'POST', '/alertas', {
      idRegistro: 'R1',
      nivelRiesgo: 'ALTO',
      descripcion: 'x',
      fecha: '2020-01-01',
    });
    expect(desconocido).toMatchObject({
      estado: 400,
      cuerpo: { message: 'La solicitud no es válida.' },
    });
    const arreglo = await pedir(
      'd1@ejemplo.edu.co',
      'POST',
      '/alertas',
      [1, 2],
    );
    expect(arreglo.estado).toBe(400);
    const larga = await pedir('d1@ejemplo.edu.co', 'POST', '/alertas', {
      idRegistro: 'R1',
      nivelRiesgo: 'ALTO',
      descripcion: 'a'.repeat(2001),
    });
    expect(larga).toMatchObject({
      estado: 400,
      cuerpo: { message: 'El texto excede la longitud permitida.' },
    });
    const sinPeriodo = await pedir(
      'd1@ejemplo.edu.co',
      'GET',
      '/alertas/emitidas',
    );
    expect(sinPeriodo).toMatchObject({
      estado: 400,
      cuerpo: { message: 'Indique el periodo académico.' },
    });
    const repetido = await pedir(
      'd1@ejemplo.edu.co',
      'GET',
      '/alertas/emitidas?periodo=a&periodo=b',
    );
    expect(repetido.estado).toBe(400);
    const sinSesion = await pedir(
      null,
      'GET',
      `/alertas/emitidas?periodo=${PERIODO}`,
    );
    expect(sinSesion.estado).toBe(401);
  });
});

describe('Flujo completo del estudiante (R02, CUD02, CUD01)', () => {
  it('radica solicitudes psicosocial y académica, con destino según la categoría, y las consulta con su estado', async () => {
    correo.enviados.length = 0;
    const psico = await pedir(
      'e1@ejemplo.edu.co',
      'POST',
      '/solicitudes',
      {
        tipoApoyo: 'PSICOLOGICA',
        motivo: 'Me siento sobrepasada por la carga',
        disponibilidad: 'Martes en la tarde',
      },
      'radicacion',
    );
    expect(psico.estado).toBe(201);
    expect(psico.cuerpo).toMatchObject({
      tipoApoyo: 'PSICOLOGICA',
      estado: 'PENDIENTE',
    });
    expect(psico.cuerpo.codigo).toMatch(/^[0-9a-f-]{36}$/);

    const academica = await pedir(
      'e1@ejemplo.edu.co',
      'POST',
      '/solicitudes',
      {
        tipoApoyo: 'ACADEMICA',
        motivo: 'Necesito apoyo en Cálculo',
      },
      'radicacion',
    );
    expect(academica.estado).toBe(201);
    expect(academica.cuerpo.disponibilidad).toBe('');

    const casos = await fuente.query<
      { id_origen: string; ruta: string | null; confidencialidad: boolean }[]
    >(
      'SELECT id_origen, ruta, confidencialidad FROM caso_riesgo WHERE id_origen = ANY($1)',
      [[psico.cuerpo.codigo, academica.cuerpo.codigo]],
    );
    const porOrigen = new Map(casos.map((c) => [c.id_origen, c]));
    expect(porOrigen.get(psico.cuerpo.codigo ?? '')).toMatchObject({
      ruta: 'PSICOLOGICA',
      confidencialidad: true,
    });
    expect(porOrigen.get(academica.cuerpo.codigo ?? '')).toMatchObject({
      ruta: null,
      confidencialidad: true,
    });

    await esperarCorreos();
    expect(correo.enviados.map((c) => c.destino).sort()).toEqual([
      'j1@ejemplo.edu.co',
      'ps1@ejemplo.edu.co',
    ]);
    for (const enviado of correo.enviados) {
      expect(`${enviado.asunto} ${enviado.cuerpo}`).not.toMatch(
        /sobrepasada|Cálculo|Estudiante E1/,
      );
    }

    const propias = await pedir<SolicitudDto[]>(
      'e1@ejemplo.edu.co',
      'GET',
      '/consulta/solicitudes',
      undefined,
      'consulta',
    );
    expect(propias.estado).toBe(200);
    expect(propias.cuerpo.map((s) => [s.codigo, s.estado])).toEqual(
      expect.arrayContaining([
        [psico.cuerpo.codigo, 'PENDIENTE'],
        [academica.cuerpo.codigo, 'PENDIENTE'],
      ]),
    );
    expect(
      propias.cuerpo.find((s) => s.codigo === psico.cuerpo.codigo)?.motivo,
    ).toBe('Me siento sobrepasada por la carga');
  });

  it('consulta sus registros y sus alertas (con curso y fecha, sin el docente)', async () => {
    const registros = await pedir(
      'e1@ejemplo.edu.co',
      'GET',
      `/consulta/registros?periodo=${PERIODO}`,
      undefined,
      'consulta',
    );
    expect(registros.estado).toBe(200);
    expect((registros.cuerpo.registros ?? []).map((r) => r.idRegistro)).toEqual(
      ['R1'],
    );
    const vacio = await pedir(
      'e1@ejemplo.edu.co',
      'GET',
      '/consulta/registros?periodo=1999-1',
      undefined,
      'consulta',
    );
    expect(vacio.cuerpo).toEqual({
      registros: [],
      mensaje: 'Información no disponible',
    });

    const alertas = await pedir<AlertaEstudianteDto[]>(
      'e1@ejemplo.edu.co',
      'GET',
      `/consulta/alertas?periodo=${PERIODO}`,
      undefined,
      'consulta',
    );
    expect(alertas.estado).toBe(200);
    expect(alertas.cuerpo.length).toBeGreaterThan(0);
    expect(alertas.cuerpo[0]).toMatchObject({
      curso: 'Cálculo',
      nivelRiesgo: 'ALTO',
    });
    expect(JSON.stringify(alertas.cuerpo)).not.toMatch(/Docente|d1@/);
  });

  it('aislamiento: otro estudiante no ve lo ajeno (ER 3.5.3)', async () => {
    const alertas = await pedir(
      'e2@ejemplo.edu.co',
      'GET',
      `/consulta/alertas?periodo=${PERIODO}`,
    );
    expect(alertas.cuerpo).toEqual([]);
    const solicitudes = await pedir(
      'e2@ejemplo.edu.co',
      'GET',
      '/consulta/solicitudes',
    );
    expect(solicitudes.cuerpo).toEqual([]);
    const registros = await pedir(
      'e2@ejemplo.edu.co',
      'GET',
      `/consulta/registros?periodo=${PERIODO}`,
    );
    expect((registros.cuerpo.registros ?? []).map((r) => r.idRegistro)).toEqual(
      ['R2'],
    );
  });

  it('D21: sin registros académicos, 403 con el texto nuevo', async () => {
    const respuesta = await pedir('e4@ejemplo.edu.co', 'POST', '/solicitudes', {
      tipoApoyo: 'ACADEMICA',
      motivo: 'Ayuda',
    });
    expect(respuesta).toMatchObject({
      estado: 403,
      cuerpo: {
        message: 'No se encontró una matrícula activa asociada a su cuenta.',
      },
    });
  });

  it('validación: motivo vacío y tipos inválidos', async () => {
    const vacio = await pedir('e1@ejemplo.edu.co', 'POST', '/solicitudes', {
      tipoApoyo: 'ACADEMICA',
      motivo: '',
    });
    expect(vacio).toMatchObject({
      estado: 400,
      cuerpo: { message: 'Describa el motivo de la solicitud' },
    });
    const arreglo = await pedir('e1@ejemplo.edu.co', 'POST', '/solicitudes', {
      tipoApoyo: 'ACADEMICA',
      motivo: 'x',
      disponibilidad: ['lunes'],
    });
    expect(arreglo).toMatchObject({
      estado: 400,
      cuerpo: { message: 'La solicitud no es válida.' },
    });
  });

  it('roles cruzados: 403', async () => {
    expect(
      (await pedir('e1@ejemplo.edu.co', 'GET', '/alertas/cursos/C1')).estado,
    ).toBe(403);
    expect(
      (
        await pedir('d1@ejemplo.edu.co', 'POST', '/solicitudes', {
          tipoApoyo: 'ACADEMICA',
          motivo: 'x',
        })
      ).estado,
    ).toBe(403);
    expect(
      (await pedir('j1@ejemplo.edu.co', 'GET', '/consulta/solicitudes')).estado,
    ).toBe(403);
    expect(
      (
        await pedir('ps1@ejemplo.edu.co', 'POST', '/alertas', {
          idRegistro: 'R1',
          nivelRiesgo: 'ALTO',
          descripcion: 'x',
        })
      ).estado,
    ).toBe(403);
  });
});

describe('Tiempos (ER 3.4.2 / CUD02)', () => {
  it('consultas en menos de 2 s y radicación en menos de 3 s', () => {
    expect(Math.max(...(tiempos['consulta'] ?? [Infinity]))).toBeLessThan(2000);
    expect(Math.max(...(tiempos['radicacion'] ?? [Infinity]))).toBeLessThan(
      3000,
    );
  });
});
