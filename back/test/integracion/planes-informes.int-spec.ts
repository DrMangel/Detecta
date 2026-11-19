import type { DataSource } from 'typeorm';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
import { UnidadTrabajoPersistente } from '../../src/persistencia/unidad-trabajo-persistente';
import {
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
  type Escenario,
  type Repositorios,
} from './escenario';
import {
  abrirFuenteAplicacion,
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
