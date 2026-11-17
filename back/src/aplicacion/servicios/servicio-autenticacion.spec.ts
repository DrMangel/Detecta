import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Docente } from '../../dominio/entidades/docente';
import type { Persona } from '../../dominio/entidades/persona';
import type { RepositorioCredenciales } from '../../dominio/repositorios/repositorio-credenciales';
import type { RepositorioPersona } from '../../dominio/repositorios/repositorio-persona';
import type { ProveedorCorreo } from '../contratos/proveedor-correo';
import { HASH_SIN_ACTIVAR, hashContrasenas } from './hash-contrasenas';
import {
  MENSAJE_CREDENCIALES_INVALIDAS,
  MENSAJE_ENLACE_INVALIDO,
  ServicioAutenticacion,
} from './servicio-autenticacion';

/** Costo mínimo admitido: las pruebas no necesitan el costo de producción. */
const COSTO = 10;
const AHORA = new Date('2026-11-17T15:00:00Z');
const CONTRASENA = 'una contraseña larga';

let hashValido: string;

beforeAll(async () => {
  hashValido = await hashContrasenas.generar(CONTRASENA, COSTO);
});

function docente(contrasenaHash: string): Docente {
  return new Docente({
    id: 'D1',
    nombre: 'Docente <Uno>',
    correo: 'd1@ejemplo.edu.co',
    contrasenaHash,
    cursos: [],
  });
}

interface Escenario {
  servicio: ServicioAutenticacion;
  personas: { buscarPorCorreo: jest.Mock };
  credenciales: {
    registrarToken: jest.Mock;
    contarTokensDesde: jest.Mock;
    canjearToken: jest.Mock;
  };
  correo: { enviar: jest.Mock };
}

function crear(persona: Persona | null, recientes = 0): Escenario {
  const personas = { buscarPorCorreo: jest.fn().mockResolvedValue(persona) };
  const credenciales = {
    registrarToken: jest.fn().mockResolvedValue(undefined),
    contarTokensDesde: jest.fn().mockResolvedValue(recientes),
    canjearToken: jest.fn().mockResolvedValue(true),
  };
  const correo = { enviar: jest.fn().mockResolvedValue(true) };
  const servicio = new ServicioAutenticacion(
    personas as unknown as RepositorioPersona,
    credenciales as unknown as RepositorioCredenciales,
    correo as unknown as ProveedorCorreo,
    {
      bcryptCosto: COSTO,
      activacionDuracionMin: 30,
      urlFrontend: 'http://localhost:5173',
    },
    () => AHORA,
  );
  return { servicio, personas, credenciales, correo };
}

const sha256 = (texto: string) =>
  createHash('sha256').update(texto).digest('hex');

describe('ServicioAutenticacion.autenticar', () => {
  afterEach(() => jest.restoreAllMocks());

  it('devuelve la persona con credenciales válidas', async () => {
    const { servicio } = crear(docente(hashValido));
    await expect(
      servicio.autenticar(' d1@ejemplo.edu.co ', CONTRASENA),
    ).resolves.toBeInstanceOf(Docente);
  });

  it.each([
    ['correo inexistente', null],
    ['cuenta sin activar (hash centinela)', 'sin-activar'],
    ['contraseña errónea', 'erronea'],
  ] as const)(
    '%s: 401 con el mismo mensaje y exactamente UNA comparación bcrypt (ajuste A)',
    async (_rama, tipo) => {
      const persona =
        tipo === null
          ? null
          : docente(tipo === 'sin-activar' ? HASH_SIN_ACTIVAR : hashValido);
      const { servicio } = crear(persona);
      await servicio.onModuleInit(); // precalcula el hash ficticio
      const comparar = jest.spyOn(hashContrasenas, 'comparar');
      const contrasena =
        tipo === 'erronea' ? 'otra contraseña larga' : CONTRASENA;

      const error = await servicio
        .autenticar('d1@ejemplo.edu.co', contrasena)
        .catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as Error).message).toBe(MENSAJE_CREDENCIALES_INVALIDAS);
      expect(comparar).toHaveBeenCalledTimes(1);
      // La cuenta sin activar se compara contra un hash bcrypt válido (el ficticio).
      expect(comparar.mock.calls[0]?.[1]).toMatch(/^\$2[aby]\$10\$/);
    },
  );

  it('el resultado no expone el hash al serializar', async () => {
    const { servicio } = crear(docente(hashValido));
    const persona = await servicio.autenticar('d1@ejemplo.edu.co', CONTRASENA);
    expect(JSON.stringify(persona)).not.toContain('$2');
  });
});

describe('ServicioAutenticacion.solicitarActivacion (D6)', () => {
  it('responde sin esperar la búsqueda ni el envío (ajuste B)', async () => {
    const { servicio, personas, correo } = crear(null);
    let liberar: (p: Persona | null) => void = () => undefined;
    personas.buscarPorCorreo.mockReturnValue(
      new Promise<Persona | null>((resolver) => {
        liberar = resolver;
      }),
    );
    const resultado = servicio.solicitarActivacion('d1@ejemplo.edu.co');
    expect(resultado).toBeUndefined(); // no devuelve una promesa que esperar
    expect(correo.enviar).not.toHaveBeenCalled();

    liberar(docente(hashValido));
    await servicio.onApplicationShutdown();
    expect(correo.enviar).toHaveBeenCalledTimes(1);
  });

  it('correo existente: guarda solo el hash del token y envía el enlace con el token en el fragmento', async () => {
    const { servicio, credenciales, correo } = crear(docente(HASH_SIN_ACTIVAR));
    servicio.solicitarActivacion('d1@ejemplo.edu.co');
    await servicio.onApplicationShutdown();

    const [destino, , cuerpo] = correo.enviar.mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(destino).toBe('d1@ejemplo.edu.co');
    const token = /\/activar#token=([A-Za-z0-9_-]{43})/.exec(cuerpo)?.[1] ?? '';
    expect(token).toHaveLength(43);
    expect(cuerpo).toContain('Docente &lt;Uno&gt;'); // nombre escapado

    const registro = credenciales.registrarToken.mock.calls[0]?.[0];
    expect(registro.hashToken).toBe(sha256(token));
    expect(JSON.stringify(registro)).not.toContain(token);
    expect(registro.expiraEn.getTime() - registro.creadoEn.getTime()).toBe(
      30 * 60_000,
    );
  });

  it('correo inexistente: no registra token ni envía correo', async () => {
    const { servicio, credenciales, correo } = crear(null);
    servicio.solicitarActivacion('nadie@ejemplo.edu.co');
    await servicio.onApplicationShutdown();
    expect(credenciales.registrarToken).not.toHaveBeenCalled();
    expect(correo.enviar).not.toHaveBeenCalled();
  });

  it('D16: con 3 solicitudes en la última hora no emite otra', async () => {
    const { servicio, credenciales, correo } = crear(docente(hashValido), 3);
    servicio.solicitarActivacion('d1@ejemplo.edu.co');
    await servicio.onApplicationShutdown();
    expect(credenciales.contarTokensDesde.mock.calls[0]?.[1]).toEqual(
      new Date(AHORA.getTime() - 60 * 60_000),
    );
    expect(credenciales.registrarToken).not.toHaveBeenCalled();
    expect(correo.enviar).not.toHaveBeenCalled();
  });

  it('un fallo del envío en segundo plano se registra sin datos personales y no rompe nada', async () => {
    const { servicio, correo } = crear(docente(hashValido));
    correo.enviar.mockRejectedValue(
      new Error('SMTP caído para d1@ejemplo.edu.co'),
    );
    const registro = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    servicio.solicitarActivacion('d1@ejemplo.edu.co');
    await servicio.onApplicationShutdown();

    expect(registro).toHaveBeenCalledTimes(1);
    expect(String(registro.mock.calls[0]?.[0])).not.toContain('@');
    registro.mockRestore();
  });
});

describe('ServicioAutenticacion.activarCuenta (D6)', () => {
  const TOKEN = 'a'.repeat(43);

  it('canjea el hash del token y guarda un hash bcrypt de la contraseña', async () => {
    const { servicio, credenciales } = crear(null);
    await servicio.activarCuenta(TOKEN, CONTRASENA);
    const [hashToken, nuevoHash, ahora] = credenciales.canjearToken.mock
      .calls[0] as [string, string, Date];
    expect(hashToken).toBe(sha256(TOKEN));
    expect(ahora).toBe(AHORA);
    await expect(hashContrasenas.comparar(CONTRASENA, nuevoHash)).resolves.toBe(
      true,
    );
  });

  it('token no canjeable (desconocido, usado, anulado o caducado): 400 genérico', async () => {
    const { servicio, credenciales } = crear(null);
    credenciales.canjearToken.mockResolvedValue(false);
    await expect(servicio.activarCuenta(TOKEN, CONTRASENA)).rejects.toThrow(
      new BadRequestException(MENSAJE_ENLACE_INVALIDO),
    );
  });

  it('token con formato inválido: 400 genérico sin consultar la BD', async () => {
    const { servicio, credenciales } = crear(null);
    await expect(servicio.activarCuenta('corto', CONTRASENA)).rejects.toThrow(
      MENSAJE_ENLACE_INVALIDO,
    );
    expect(credenciales.canjearToken).not.toHaveBeenCalled();
  });

  it('política: mínimo 12 caracteres (grafemas) y máximo 72 bytes UTF-8', async () => {
    const { servicio } = crear(null);
    await expect(servicio.activarCuenta(TOKEN, 'corta1234')).rejects.toThrow(
      /al menos 12 caracteres/,
    );
    // 12 caracteres visibles, aunque algunos ocupen varios bytes: se acepta.
    await expect(
      servicio.activarCuenta(TOKEN, 'ñandú😀😀😀😀😀😀😀'),
    ).resolves.toBeUndefined();
    // 25 "€" son 75 bytes UTF-8: se rechaza.
    await expect(servicio.activarCuenta(TOKEN, '€'.repeat(25))).rejects.toThrow(
      /no puede superar 72 bytes/,
    );
  });
});
