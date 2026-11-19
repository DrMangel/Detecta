import { Client } from 'pg';
import type { DataSource } from 'typeorm';
import { Modalidad } from '../../src/dominio/entidades/modalidad';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
import { UnidadTrabajoPersistente } from '../../src/persistencia/unidad-trabajo-persistente';
import {
  casoDeAlerta,
  crearEscenario,
  crearRepositorios,
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
 * B9, R9: el cargador de grafos no lanza consultas en paralelo sobre la
 * conexión única de una transacción. pg lo desaprueba con el aviso
 * "Calling client.query() when the client is already executing a query"
 * (pg/lib/client.js; pg@9 lo eliminará). El aviso sale una sola vez por
 * proceso y Jest aísla `process`, así que la prueba comprueba la MISMA
 * condición que pg usa para emitirlo (client.js: `_queryQueue.length > 0`
 * sin modo pipeline) en cada llamada a Client.prototype.query.
 */

type ClientePg = { _queryQueue: unknown[]; pipeline?: boolean };
const queryOriginal = Client.prototype.query;
/** Llamadas a client.query() con otra consulta ya en cola en ese cliente. */
let consultasEncoladas = 0;

let fuente: DataSource;
let contador: ContadorConsultas;
let repos: Repositorios;
let esc: Escenario;

beforeAll(async () => {
  Client.prototype.query = function (
    this: ClientePg,
    ...argumentos: unknown[]
  ) {
    if (this._queryQueue.length > 0 && !this.pipeline) {
      consultasEncoladas += 1;
    }
    return queryOriginal.apply(this, argumentos);
  };
  await migrarBasePruebas();
  await vaciarBasePruebas();
  contador = new ContadorConsultas();
  fuente = await abrirFuenteAplicacion(contador);
  repos = crearRepositorios(fuente);
  esc = await crearEscenario(repos);
});

afterAll(async () => {
  Client.prototype.query = queryOriginal;
  await fuente.destroy();
});

describe('Consultas del cargador dentro de una transacción (B9, R9)', () => {
  it('cargar un grafo con varias tablas por nivel dentro de una transacción no encola consultas en el mismo cliente de pg', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r1);
    caso.canalizar(RutaAtencion.PSICOLOGICA);
    caso.asignarPsicologo(esc.ps1);
    caso.aprobar();
    caso.programarCita(new Date('2027-02-01T15:00:00Z'), Modalidad.VIRTUAL);
    await repos.casos.guardar(caso);

    const unidad = new UnidadTrabajoPersistente(fuente);
    consultasEncoladas = 0;
    const recargado = await unidad.ejecutar((r) =>
      r.casos.buscarPorId(caso.idCaso),
    );

    expect(recargado?.citas).toHaveLength(1);
    expect(consultasEncoladas).toBe(0);
  });

  it('fuera de una transacción y dentro de ella se hacen las mismas consultas', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r2);
    contador.total = 0;
    await repos.casos.buscarPorId(caso.idCaso);
    const fuera = contador.total;
    const unidad = new UnidadTrabajoPersistente(fuente);
    contador.total = 0;
    await unidad.ejecutar((r) => r.casos.buscarPorId(caso.idCaso));
    // BEGIN y COMMIT de la transacción.
    expect(contador.total - 2).toBe(fuera);
  });
});

describe('trazarCaso en un solo UPDATE (B9, R4)', () => {
  async function traza(idCaso: string) {
    const [fila] = await fuente.query<
      {
        fecha_canalizacion: Date | null;
        fecha_consentimiento: Date | null;
        id_psicologo_consentimiento: string | null;
      }[]
    >(
      'SELECT fecha_canalizacion, fecha_consentimiento, id_psicologo_consentimiento FROM caso_riesgo WHERE id_caso = $1',
      [idCaso],
    );
    return fila;
  }

  it('guardar(caso) sin citas hace 4 consultas (antes 5, medición M8)', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r1);
    contador.total = 0;
    await repos.casos.guardar(caso);
    expect(contador.total).toBe(4);
  });

  it('fecha_canalizacion y la traza del consentimiento se fijan una sola vez y no se sobrescriben', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r2);
    caso.canalizar(RutaAtencion.PSICOLOGICA);
    await repos.casos.guardar(caso);
    const primera = await traza(caso.idCaso);
    expect(primera?.fecha_canalizacion).toBeInstanceOf(Date);
    expect(primera?.fecha_consentimiento).toBeNull();

    await new Promise((resolver) => setTimeout(resolver, 20));
    caso.asignarPsicologo(esc.ps1);
    caso.confirmarConsentimiento();
    await repos.casos.guardar(caso);
    const segunda = await traza(caso.idCaso);
    expect(segunda?.fecha_canalizacion).toEqual(primera?.fecha_canalizacion);
    expect(segunda?.id_psicologo_consentimiento).toBe('PS1');
    expect(segunda?.fecha_consentimiento).toBeInstanceOf(Date);

    await new Promise((resolver) => setTimeout(resolver, 20));
    await repos.casos.guardar(caso);
    const tercera = await traza(caso.idCaso);
    expect(tercera).toEqual(segunda);
  });
});
