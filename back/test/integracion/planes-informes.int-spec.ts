import type { DataSource } from 'typeorm';
import { GeneradorInformeRiesgo } from '../../src/aplicacion/servicios/generador-informe-riesgo';
import type { Persona } from '../../src/dominio/entidades/persona';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
import { UnidadTrabajoPersistente } from '../../src/persistencia/unidad-trabajo-persistente';
import {
  casoDeAlerta,
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
  PERIODO,
  type Escenario,
  type Repositorios,
} from './escenario';
import {
  abrirFuenteAplicacion,
  ContadorConsultas,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';

/*
 * Persistencia de B8 contra detecta_pruebas: plan y cursos en una sola
 * transacción (B8a).
 */

let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
let unidad: UnidadTrabajoPersistente;

async function contarPlanes(): Promise<[number, number]> {
  const [fila] = await fuente.query<{ planes: string; cursos: string }[]>(
    `SELECT (SELECT count(*) FROM plan_nivelacion) AS planes,
            (SELECT count(*) FROM plan_nivelacion_curso) AS cursos`,
  );
  return [Number(fila?.planes), Number(fila?.cursos)];
}

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
  esc = await crearEscenario(repos);
  unidad = new UnidadTrabajoPersistente(fuente);
});

afterAll(async () => {
  await fuente.destroy();
});

describe('Plan de nivelación en una transacción (B8a)', () => {
  it('el plan y sus cursos se confirman juntos; con un fallo después, se revierten juntos', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.ACADEMICA,
    );
    caso.canalizar(RutaAtencion.ACADEMICA);
    await repos.casos.guardar(caso);

    const antes = await contarPlanes();
    await expect(
      unidad.ejecutar(async (r) => {
        const plan = esc.j1.estructurarPlanNivelacion(
          caso,
          [esc.c1, esc.c0],
          'Tutor',
          'T1',
          '',
        );
        await r.planes.guardar(plan);
        throw new Error('fallo forzado');
      }),
    ).rejects.toThrow('fallo forzado');
    expect(await contarPlanes()).toEqual(antes);

    const plan = await unidad.ejecutar(async (r) => {
      const nuevo = esc.j1.estructurarPlanNivelacion(
        caso,
        [esc.c1, esc.c0],
        'Tutor',
        'T1',
        '',
      );
      await r.planes.guardar(nuevo);
      return nuevo;
    });
    expect(await contarPlanes()).toEqual([antes[0] + 1, antes[1] + 2]);
    expect(
      (await repos.planes.buscarPorId(plan.idPlan))?.cursos
        .map((c) => c.idCurso)
        .sort(),
    ).toEqual(['C0', 'C1']);
  });
});

describe('Informe de riesgo: autoría y programa (B8b, respuesta 4)', () => {
  async function informeDeCalculo(autor: Persona) {
    const generador = new GeneradorInformeRiesgo(
      repos.alertas,
      repos.casos,
      repos.planes,
      repos.informes,
      () => new Date('2026-11-18T15:00:00Z'),
    );
    return generador.generar(PERIODO, 'P1', esc.c1, autor);
  }

  it('guardarConAutor fija el programa y exactamente un autor (Jefe o Psicólogo)', async () => {
    await casoDeAlerta(repos, esc.d1, esc.r1);
    const delJefe = await informeDeCalculo(esc.j1);
    const delPsicologo = await informeDeCalculo(esc.ps1);
    const filas = await fuente.query<
      {
        id_informe: string;
        id_programa: string;
        id_jefe: string | null;
        id_psicologo: string | null;
      }[]
    >(
      'SELECT id_informe, id_programa, id_jefe, id_psicologo FROM informe_riesgo WHERE id_informe = ANY($1) ORDER BY id_jefe NULLS LAST',
      [[delJefe?.idInforme, delPsicologo?.idInforme]],
    );
    expect(
      filas.map(({ id_programa, id_jefe, id_psicologo }) => [
        id_programa,
        id_jefe,
        id_psicologo,
      ]),
    ).toEqual([
      ['P1', 'J1', null],
      ['P1', null, 'PS1'],
    ]);
    expect(
      await repos.informes.buscarProgramaDelInforme(delJefe?.idInforme ?? ''),
    ).toBe('P1');
    expect(
      await repos.informes.buscarProgramaDelInforme('NO-EXISTE'),
    ).toBeNull();
    // Recargado: el informe conserva sus totales y su curso.
    expect(
      await repos.informes.buscarPorId(delJefe?.idInforme ?? ''),
    ).toMatchObject({ periodo: PERIODO, totalAlertas: delJefe?.totalAlertas });
  });

  it('la BD rechaza un informe sin autor o con dos autores (CHECK) y sin programa (NOT NULL)', async () => {
    const insertar = (
      programa: string | null,
      jefe: string | null,
      psicologo: string | null,
    ) =>
      fuente.query(
        `INSERT INTO informe_riesgo (id_informe, fecha, periodo, total_alertas, total_casos, total_planes, resumen, id_curso, id_programa, id_jefe, id_psicologo)
         VALUES (gen_random_uuid()::text, now(), '2026-2', 0, 0, 0, 'x', 'C1', $1, $2, $3)`,
        [programa, jefe, psicologo],
      );
    await expect(insertar('P1', null, null)).rejects.toThrow(
      /ck_informe_un_autor/,
    );
    await expect(insertar('P1', 'J1', 'PS1')).rejects.toThrow(
      /ck_informe_un_autor/,
    );
    await expect(insertar(null, 'J1', null)).rejects.toThrow(/id_programa/);
  });

  it('guardarConAutor rechaza un autor que no es Jefe ni Psicólogo', async () => {
    const informe = await informeDeCalculo(esc.j1);
    await expect(
      repos.informes.guardarConAutor(informe!, 'P1', esc.d1),
    ).rejects.toThrow(/Jefe de Departamento o un Psicólogo/);
  });
});

describe('GeneradorInformeRiesgo sin N+1 (B8b, ajuste E)', () => {
  it('el número de consultas no crece con el número de alertas, casos y planes', async () => {
    const contador = new ContadorConsultas();
    const contada = await abrirFuenteAplicacion(contador);
    try {
      const r = crearRepositorios(contada);
      const generador = new GeneradorInformeRiesgo(
        r.alertas,
        r.casos,
        r.planes,
        r.informes,
        () => new Date(),
      );
      // Lote mixto: alertas, casos archivados y planes (mismo tipo de grafo).
      async function lote(cantidad: number): Promise<void> {
        for (let i = 0; i < cantidad; i++) {
          const { caso } = await casoDeAlerta(
            repos,
            esc.d1,
            i % 2 === 0 ? esc.r1 : esc.r2,
          );
          if (i % 3 === 0) {
            caso.canalizar(RutaAtencion.ACADEMICA);
            await repos.casos.guardar(caso);
            await repos.planes.guardar(
              esc.j1.estructurarPlanNivelacion(caso, [esc.c1], 'T', 'T', ''),
            );
          } else {
            await fuente.query(
              `UPDATE caso_riesgo SET estado = 'ARCHIVADO' WHERE id_caso = $1`,
              [caso.idCaso],
            );
          }
        }
      }
      async function consultas(): Promise<number> {
        contador.total = 0;
        await generador.generar(PERIODO, 'P1', esc.c1, esc.j1);
        return contador.total;
      }
      await lote(6);
      const conPocos = await consultas();
      await lote(30);
      const conMuchos = await consultas();
      expect(conMuchos).toBe(conPocos);
      process.stdout
        .write(`CONSULTAS_INFORME ${conPocos} (6 elementos) / ${conMuchos} (36 elementos)
`);
    } finally {
      await contada.destroy();
    }
  });
});
