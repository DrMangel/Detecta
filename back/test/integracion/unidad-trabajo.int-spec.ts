import type { DataSource } from 'typeorm';
import { Estudiante } from '../../src/dominio/entidades/estudiante';
import { RepositorioPersistenteCredenciales } from '../../src/persistencia/repositorio-persistente-credenciales';
import { UnidadTrabajoPersistente } from '../../src/persistencia/unidad-trabajo-persistente';
import {
  crearEscenario,
  crearRepositorios,
  estudiante,
  type Escenario,
  type Repositorios,
} from './escenario';
import {
  abrirFuenteAplicacion,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';

/*
 * UnidadTrabajo (respuesta 5 de Ivan) y regla de persistencia del hash
 * (respuesta 6), contra detecta_pruebas.
 */

let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
let unidad: UnidadTrabajoPersistente;

async function hashDe(id: string): Promise<string | undefined> {
  const [fila] = await fuente.query<{ contrasena_hash: string }[]>(
    'SELECT contrasena_hash FROM persona WHERE id = $1',
    [id],
  );
  return fila?.contrasena_hash;
}

beforeAll(async () => {
  await migrarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
  unidad = new UnidadTrabajoPersistente(fuente);
});

afterAll(async () => {
  await fuente.destroy();
});

beforeEach(async () => {
  await vaciarBasePruebas();
  esc = await crearEscenario(repos);
});

describe('UnidadTrabajo', () => {
  it('revierte TODO si el trabajo falla después de escribir', async () => {
    await expect(
      unidad.ejecutar(async (r) => {
        await r.personas.guardar(estudiante('E900', esc.p1));
        await r.personas.guardar(estudiante('E901', esc.p1));
        throw new Error('fallo de infraestructura simulado');
      }),
    ).rejects.toThrow('fallo de infraestructura simulado');
    expect(await repos.personas.buscarPorId('E900')).toBeNull();
    expect(await repos.personas.buscarPorId('E901')).toBeNull();
  });

  it('los repositorios de la unidad ven sus cambios aún no confirmados; fuera no se ven hasta confirmar', async () => {
    let vistoDentro: string | undefined;
    let vistoFuera: unknown = 'sin consultar';
    await unidad.ejecutar(async (r) => {
      await r.personas.guardar(estudiante('E902', esc.p1));
      vistoDentro = (await r.personas.buscarPorId('E902'))?.id;
      vistoFuera = await repos.personas.buscarPorId('E902');
    });
    expect(vistoDentro).toBe('E902');
    expect(vistoFuera).toBeNull();
    expect((await repos.personas.buscarPorId('E902'))?.id).toBe('E902');
  });

  it('bloqueo exclusivo: una segunda unidad con el mismo bloqueo falla sin esperar', async () => {
    let liberar: () => void = () => undefined;
    const primera = unidad.ejecutar(
      () => new Promise<void>((resolver) => (liberar = resolver)),
      { bloqueoExclusivo: 'prueba.bloqueo' },
    );
    await new Promise((resolver) => setTimeout(resolver, 100));
    const inicio = performance.now();
    await expect(
      unidad.ejecutar(() => Promise.resolve(), {
        bloqueoExclusivo: 'prueba.bloqueo',
      }),
    ).rejects.toThrow(/está en uso/);
    expect(performance.now() - inicio).toBeLessThan(1000);
    liberar();
    await primera;
  });
});

describe('regla del hash (B4): guardar(persona) nunca cambia contrasena_hash de una fila existente', () => {
  it('guardar con otro hash no lo cambia; al insertar sí se guarda', async () => {
    expect(await hashDe('E1')).toBe('$2b$10$hash-de-prueba-E1');
    await repos.personas.guardar(
      new Estudiante({
        id: 'E1',
        nombre: 'Nombre Nuevo',
        correo: 'e1@ejemplo.edu.co',
        contrasenaHash: '!SIN_ACTIVAR',
        fechaNacimiento: new Date(2000, 4, 15),
        programa: esc.p1,
      }),
    );
    expect(await hashDe('E1')).toBe('$2b$10$hash-de-prueba-E1');
    expect((await repos.personas.buscarPorId('E1'))?.nombre).toBe(
      'Nombre Nuevo',
    );
  });

  it('cambiar el correo anula los tokens de activación pendientes', async () => {
    const credenciales = new RepositorioPersistenteCredenciales(fuente);
    await credenciales.registrarToken({
      idToken: 'T1',
      idPersona: 'E1',
      hashToken: 'a'.repeat(64),
      creadoEn: new Date(),
      expiraEn: new Date(Date.now() + 30 * 60_000),
    });
    await repos.personas.guardar(
      new Estudiante({
        id: 'E1',
        nombre: 'Estudiante E1',
        correo: 'nuevo.correo@ejemplo.edu.co',
        contrasenaHash: 'x',
        fechaNacimiento: new Date(2000, 4, 15),
        programa: esc.p1,
      }),
    );
    const [fila] = await fuente.query<{ anulado: boolean }[]>(
      "SELECT anulado_en IS NOT NULL AS anulado FROM token_activacion WHERE id_token = 'T1'",
    );
    expect(fila?.anulado).toBe(true);
    await expect(
      credenciales.canjearToken('a'.repeat(64), '$2b$12$x', new Date()),
    ).resolves.toBe(false);
  });

  it('guardar una persona existente con otro rol lanza Error', async () => {
    await expect(
      repos.personas.guardar(estudiante('D1', esc.p1)),
    ).rejects.toThrow('La persona D1 ya existe con otro rol');
  });
});
