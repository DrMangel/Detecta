import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { RepositorioPersistenteCredenciales } from '../../src/persistencia/repositorio-persistente-credenciales';
import { crearEscenario, crearRepositorios } from './escenario';
import {
  abrirFuenteAplicacion,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';

/*
 * RepositorioCredenciales contra PostgreSQL (D6, B3), con detecta_app.
 */

let fuente: DataSource;
let credenciales: RepositorioPersistenteCredenciales;

const AHORA = new Date('2026-11-17T15:00:00Z');
const minutos = (n: number) => new Date(AHORA.getTime() + n * 60_000);

function nuevoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

async function registrar(
  idPersona: string,
  hash: string,
  creadoEn = AHORA,
  expiraEn = minutos(30),
): Promise<void> {
  await credenciales.registrarToken({
    idToken: randomUUID(),
    idPersona,
    hashToken: hash,
    creadoEn,
    expiraEn,
  });
}

async function hashDe(idPersona: string): Promise<string> {
  const [fila] = await fuente.query(
    'SELECT contrasena_hash FROM persona WHERE id = $1',
    [idPersona],
  );
  return fila.contrasena_hash;
}

beforeAll(async () => {
  await migrarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  credenciales = new RepositorioPersistenteCredenciales(fuente);
});

afterAll(async () => {
  await fuente.destroy();
});

beforeEach(async () => {
  await vaciarBasePruebas();
  await crearEscenario(crearRepositorios(fuente));
});

describe('RepositorioCredenciales (token_activacion)', () => {
  it('guarda solo el hash SHA-256: ninguna columna contiene el token en claro', async () => {
    const { token, hash } = nuevoToken();
    await registrar('D1', hash);
    const filas: Record<string, unknown>[] = await fuente.query(
      'SELECT * FROM token_activacion',
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]?.['hash_token']).toBe(hash);
    expect(JSON.stringify(filas)).not.toContain(token);
  });

  it('canjea un token vigente: guarda el hash nuevo y lo marca usado; un segundo canje falla', async () => {
    const { hash } = nuevoToken();
    await registrar('D1', hash);
    await expect(
      credenciales.canjearToken(hash, '$2b$12$nuevo', minutos(5)),
    ).resolves.toBe(true);
    expect(await hashDe('D1')).toBe('$2b$12$nuevo');
    const [fila] = await fuente.query('SELECT usado_en FROM token_activacion');
    expect(fila.usado_en).toEqual(minutos(5));

    await expect(
      credenciales.canjearToken(hash, '$2b$12$otro', minutos(6)),
    ).resolves.toBe(false);
    expect(await hashDe('D1')).toBe('$2b$12$nuevo');
  });

  it('un token caducado no se canjea', async () => {
    const { hash } = nuevoToken();
    await registrar('D1', hash);
    await expect(
      credenciales.canjearToken(hash, '$2b$12$x', minutos(30)),
    ).resolves.toBe(false);
  });

  it('emitir un token nuevo anula los anteriores sin usar', async () => {
    const primero = nuevoToken();
    const segundo = nuevoToken();
    await registrar('D1', primero.hash);
    await registrar('D1', segundo.hash, minutos(1), minutos(31));
    await expect(
      credenciales.canjearToken(primero.hash, '$2b$12$x', minutos(2)),
    ).resolves.toBe(false);
    await expect(
      credenciales.canjearToken(segundo.hash, '$2b$12$y', minutos(2)),
    ).resolves.toBe(true);
  });

  it('un token desconocido no se canjea', async () => {
    await expect(
      credenciales.canjearToken(nuevoToken().hash, '$2b$12$x', AHORA),
    ).resolves.toBe(false);
  });

  it('dos canjes simultáneos del mismo token: solo uno tiene éxito', async () => {
    const { hash } = nuevoToken();
    await registrar('D1', hash);
    const resultados = await Promise.all([
      credenciales.canjearToken(hash, '$2b$12$a', minutos(1)),
      credenciales.canjearToken(hash, '$2b$12$b', minutos(1)),
    ]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  it('contarTokensDesde cuenta los emitidos desde una fecha (D16)', async () => {
    await registrar('D1', nuevoToken().hash, minutos(-90), minutos(-60));
    await registrar('D1', nuevoToken().hash, minutos(-30), minutos(0));
    await registrar('D1', nuevoToken().hash, AHORA, minutos(30));
    await expect(
      credenciales.contarTokensDesde('D1', minutos(-60)),
    ).resolves.toBe(2);
  });
});
