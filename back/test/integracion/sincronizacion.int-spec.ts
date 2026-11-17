import type { DataSource } from 'typeorm';
import {
  MENSAJES_TABLA_2,
  omisionesVacias,
} from '../../src/aplicacion/contratos/conector-bd-institucional';
import { RecursoOcupadoError } from '../../src/aplicacion/contratos/unidad-trabajo';
import { ServicioSincronizacion } from '../../src/aplicacion/servicios/servicio-sincronizacion';
import { Estudiante } from '../../src/dominio/entidades/estudiante';
import { UnidadTrabajoPersistente } from '../../src/persistencia/unidad-trabajo-persistente';
import { crearRepositorios, type Repositorios } from './escenario';
import {
  abrirFuenteVerificacionInstitucional,
  AHORA_PRUEBAS,
  configuracionEjemplo,
  configurarDetecta,
  crearConector,
  fuenteLector,
  huellaInstitucional,
} from './soporte-institucional';
import {
  abrirFuenteAplicacion,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';

/*
 * Sincronización de punta a punta (B4): lee institucional_demo como
 * institucional_lector y escribe en detecta_pruebas con detecta_app.
 * Requiere `npm run bd:institucional`. Reloj fijo: 2026-11-17.
 */

let fuente: DataSource;
let lector: DataSource;
let verificacion: DataSource;
let repos: Repositorios;
let servicio: ServicioSincronizacion;

async function contar(sql: string): Promise<number> {
  const [fila] = await fuente.query<{ total: number }[]>(sql);
  return fila?.total ?? 0;
}

beforeAll(async () => {
  await migrarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  lector = fuenteLector();
  await lector.initialize();
  verificacion = await abrirFuenteVerificacionInstitucional();
  repos = crearRepositorios(fuente);
  servicio = new ServicioSincronizacion(
    crearConector(lector, repos),
    new UnidadTrabajoPersistente(fuente),
    repos.cursos,
    () => AHORA_PRUEBAS,
  );
});

afterAll(async () => {
  await fuente.destroy();
  await lector.destroy();
  await verificacion.destroy();
});

beforeEach(async () => {
  await vaciarBasePruebas();
  await configurarDetecta(repos);
});

describe('rendimiento (ER Tabla 2 y §3.4)', () => {
  it('conectar() en menos de 5 s y un curso de 60 estudiantes en menos de 10 s', async () => {
    const conector = crearConector(lector, repos);
    let inicio = performance.now();
    await expect(conector.conectar()).resolves.toBe(true);
    const msConectar = performance.now() - inicio;

    inicio = performance.now();
    const actualizados = await servicio.sincronizarCurso('ISOF-101');
    const msCurso = performance.now() - inicio;

    console.log(
      `Tiempos reales: conectar() ${msConectar.toFixed(0)} ms; curso de 60 estudiantes ${msCurso.toFixed(0)} ms`,
    );
    expect(actualizados).toBe(60);
    expect(msConectar).toBeLessThan(5000);
    expect(msCurso).toBeLessThan(10000);
  });
});

describe('sincronizarCurso', () => {
  it('crea los 60 estudiantes sin activar, con sus registros, y marca el curso', async () => {
    await servicio.sincronizarCurso('ISOF-101');
    expect(
      await contar(
        "SELECT count(*)::int AS total FROM persona WHERE rol = 'ESTUDIANTE' AND contrasena_hash = '!SIN_ACTIVAR'",
      ),
    ).toBe(60);
    expect(
      await contar(
        "SELECT count(*)::int AS total FROM registro_academico WHERE id_curso = 'ISOF-101'",
      ),
    ).toBe(60);
    expect(
      (await repos.cursos.buscarPorId('ISOF-101'))?.ultimaSincronizacion,
    ).toEqual(AHORA_PRUEBAS);
    // Menor de edad del CSV (nacido el 2012-03-14), con el reloj fijo.
    const menor = (await repos.personas.buscarPorId('2026005')) as Estudiante;
    expect(menor.esMenorDeEdad(AHORA_PRUEBAS)).toBe(true);
    const adulto = (await repos.personas.buscarPorId('2026001')) as Estudiante;
    expect(adulto.esMenorDeEdad(AHORA_PRUEBAS)).toBe(false);
  });

  it('es idempotente: repetirla no duplica estudiantes ni registros', async () => {
    await servicio.sincronizarCurso('ISOF-101');
    await expect(servicio.sincronizarCurso('ISOF-101')).resolves.toBe(60);
    expect(
      await contar(
        "SELECT count(*)::int AS total FROM persona WHERE rol = 'ESTUDIANTE'",
      ),
    ).toBe(60);
    expect(
      await contar('SELECT count(*)::int AS total FROM registro_academico'),
    ).toBe(60);
  });

  it('CALC-201: omite y cuenta las filas inválidas por causa, con los mensajes aprobados', async () => {
    await expect(servicio.sincronizarCurso('CALC-201')).resolves.toBe(4);
    const resultado = servicio.obtenerUltimoResultado();
    expect(resultado?.desglose).toEqual({
      ...omisionesVacias(),
      calificacionAsistencia: 3,
      identificacion: 3,
      correo: 2,
      fechaNacimiento: 2,
      programa: 2,
    });
    expect(resultado?.omitidos).toBe(12);
    expect(resultado?.mensajes).toEqual([
      MENSAJES_TABLA_2.conexionEstablecida,
      'Sincronización completada: Se han actualizado 4 registros académicos en la persistencia del sistema.',
      'Advertencia de sincronización: Se omitieron 3 registros debido a datos de calificación o asistencia fuera de rango.',
      'Advertencia de sincronización: Se omitieron 9 registros por datos de identificación, correo, fecha de nacimiento o programa no válidos o no configurados.',
    ]);
    // La fila con el correo del docente no tocó al docente.
    expect((await repos.personas.buscarPorId('DOC-EJEMPLO'))?.nombre).toBe(
      'Docente de Ejemplo',
    );
    expect(await repos.personas.buscarPorId('2026111')).toBeNull();
  });
});

describe('sincronizarTodo', () => {
  it('una sola ejecución: el estudiante inconsistente entre cursos omite todas sus filas', async () => {
    await expect(servicio.sincronizarTodo()).resolves.toBe(64);
    const resultado = servicio.obtenerUltimoResultado();
    expect(resultado?.desglose.datosInconsistentesEstudiante).toBe(2);
    expect(resultado?.omitidos).toBe(14);
    expect(await repos.personas.buscarPorId('2026002')).toBeNull();
    // El curso no configurado (QUIM-999) nunca se lee.
    expect(await repos.personas.buscarPorId('2026115')).toBeNull();
  });

  it('no altera el hash de una cuenta ya activada', async () => {
    await servicio.sincronizarCurso('ISOF-101');
    await fuente.query(
      "UPDATE persona SET contrasena_hash = '$2b$12$hash-de-cuenta-activada-de-prueba' WHERE id = '2026003'",
    );
    await servicio.sincronizarTodo();
    const [fila] = await fuente.query<{ contrasena_hash: string }[]>(
      "SELECT contrasena_hash FROM persona WHERE id = '2026003'",
    );
    expect(fila?.contrasena_hash).toBe(
      '$2b$12$hash-de-cuenta-activada-de-prueba',
    );
  });

  it('dos sincronizaciones simultáneas: una falla sin esperar (pg_try_advisory_xact_lock)', async () => {
    const resultados = await Promise.allSettled([
      servicio.sincronizarTodo(),
      servicio.sincronizarTodo(),
    ]);
    const rechazos = resultados.filter((r) => r.status === 'rejected');
    expect(rechazos).toHaveLength(1);
    expect((rechazos[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      RecursoOcupadoError,
    );
  });
});

describe('solo lectura de institucional_demo', () => {
  it('la sincronización no escribe nada en institucional_demo', async () => {
    const antes = await huellaInstitucional(verificacion);
    await servicio.sincronizarTodo();
    await servicio.sincronizarCurso('CALC-201');
    expect(await huellaInstitucional(verificacion)).toBe(antes);
  });

  it('institucional_lector no puede leer la tabla base ni escribir en la vista', async () => {
    await expect(
      lector.query('SELECT * FROM matricula_institucional LIMIT 1'),
    ).rejects.toThrow(/permission denied/);
    await expect(
      lector.query(
        "INSERT INTO vista_estudiantes_matriculados (id_estudiante) VALUES ('X')",
      ),
    ).rejects.toThrow(/read-only transaction|permission denied/);
    const [privilegios] = await verificacion.query<Record<string, boolean>[]>(
      `SELECT has_table_privilege('institucional_lector', 'matricula_institucional', 'SELECT') AS tabla_select,
              has_table_privilege('institucional_lector', 'vista_estudiantes_matriculados', 'INSERT') AS vista_insert,
              has_table_privilege('institucional_lector', 'vista_estudiantes_matriculados', 'SELECT') AS vista_select`,
    );
    expect(privilegios).toEqual({
      tabla_select: false,
      vista_insert: false,
      vista_select: true,
    });
  });
});

describe('errores del conector (mensajes de la Tabla 2)', () => {
  it('estructura incompleta: "Estructura de datos no reconocida…"', async () => {
    const conector = crearConector(lector, repos, {
      ...configuracionEjemplo(),
      origen: 'vista_estructura_incompleta',
    });
    await expect(conector.conectar()).rejects.toThrow(
      MENSAJES_TABLA_2.estructura,
    );
  });

  it('credenciales erróneas: "Credenciales de acceso o permisos insuficientes."', async () => {
    const conector = crearConector(
      fuenteLector({ password: 'incorrecta' }),
      repos,
    );
    await expect(conector.conectar()).rejects.toThrow(
      MENSAJES_TABLA_2.credenciales,
    );
  });

  it('sin servidor: "No fue posible establecer conexión… (Tiempo de espera agotado)."', async () => {
    const conector = crearConector(fuenteLector({ port: 1 }), repos);
    await expect(conector.conectar()).rejects.toThrow(
      MENSAJES_TABLA_2.sinConexion,
    );
  });

  it('un error de conexión no deja nada escrito', async () => {
    const fallido = new ServicioSincronizacion(
      crearConector(fuenteLector({ port: 1 }), repos),
      new UnidadTrabajoPersistente(fuente),
      repos.cursos,
      () => AHORA_PRUEBAS,
    );
    await expect(fallido.sincronizarTodo()).rejects.toThrow(
      MENSAJES_TABLA_2.sinConexion,
    );
    expect(
      await contar('SELECT count(*)::int AS total FROM registro_academico'),
    ).toBe(0);
  });
});
