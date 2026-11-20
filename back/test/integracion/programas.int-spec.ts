import { Programa } from '../../src/dominio/entidades/programa';
import { ConsultaProgramas } from '../../src/aplicacion/servicios/consulta-programas';
import { crearRepositorioPrograma } from '../../src/persistencia/repositorios-genericos';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  ContadorConsultas,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';
import type { DataSource } from 'typeorm';

let fuente: DataSource;
const contador = new ContadorConsultas();

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion(contador);
});

afterAll(async () => {
  await fuente.destroy();
});

describe('Consulta de programas (B10)', () => {
  it('usa detecta_app, que tiene SELECT real sobre programa', async () => {
    const [fila] = await fuente.query<
      { usuario: string; puedeLeer: boolean }[]
    >(
      `SELECT current_user AS usuario,
              has_table_privilege(current_user, 'programa', 'SELECT') AS "puedeLeer"`,
    );

    expect(fila).toEqual({ usuario: 'detecta_app', puedeLeer: true });
  });

  it('consulta programas sin relaciones y la consulta devuelve el orden español', async () => {
    const repositorio = crearRepositorioPrograma(fuente);
    await repositorio.guardar(
      new Programa({ idPrograma: 'P5', nombre: 'zoología' }),
    );
    await repositorio.guardar(
      new Programa({ idPrograma: 'P4', nombre: 'Psicología' }),
    );
    await repositorio.guardar(
      new Programa({ idPrograma: 'P3', nombre: 'asesoría' }),
    );
    await repositorio.guardar(
      new Programa({ idPrograma: 'P2', nombre: 'Álgebra' }),
    );
    await repositorio.guardar(
      new Programa({ idPrograma: 'P1', nombre: 'algebra' }),
    );
    const consulta = new ConsultaProgramas(repositorio);
    contador.total = 0;

    await expect(consulta.ejecutar()).resolves.toEqual([
      { idPrograma: 'P1', nombre: 'algebra' },
      { idPrograma: 'P2', nombre: 'Álgebra' },
      { idPrograma: 'P3', nombre: 'asesoría' },
      { idPrograma: 'P4', nombre: 'Psicología' },
      { idPrograma: 'P5', nombre: 'zoología' },
    ]);
    expect(contador.total).toBe(2);
    expect(BASE_PRUEBAS).toBe('detecta_pruebas');
  });
});
