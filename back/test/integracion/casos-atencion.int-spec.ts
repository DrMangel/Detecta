import type { DataSource } from 'typeorm';
import { BloqueoAgotadoError } from '../../src/aplicacion/contratos/unidad-trabajo';
import { EstadoCita } from '../../src/dominio/entidades/estado-cita';
import { Modalidad } from '../../src/dominio/entidades/modalidad';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
import { TipoAsesoria } from '../../src/dominio/entidades/tipo-asesoria';
import { RepositorioPersistenteCasoRiesgo } from '../../src/persistencia/repositorios-persistentes';
import { UnidadTrabajoPersistente } from '../../src/persistencia/unidad-trabajo-persistente';
import {
  casoDeAlerta,
  casoDeSolicitud,
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
 * Persistencia de B7 contra detecta_pruebas:
 * - visibilidad del Jefe en la consulta (ajuste A);
 * - trazabilidad de la canalización y del consentimiento (respuesta 10);
 * - bloqueos con espera: orden, vencimiento, espacio de claves y ausencia
 *   de interbloqueo (respuesta 7, ajuste B).
 */

let fuente: DataSource;
let otraFuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
let unidad: UnidadTrabajoPersistente;

const esperar = (ms: number) =>
  new Promise((resolver) => setTimeout(resolver, ms));

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  otraFuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
  esc = await crearEscenario(repos);
  unidad = new UnidadTrabajoPersistente(fuente);
});

afterAll(async () => {
  await otraFuente.destroy();
  await fuente.destroy();
});

describe('buscarParaPrograma: visibilidad del Jefe en la consulta (ajuste A)', () => {
  it('alerta y solicitud académica del programa: visibles; psicosocial: nunca', async () => {
    const alerta = await casoDeAlerta(repos, esc.d1, esc.r1);
    const academica = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.ACADEMICA,
    );
    const psicosocial = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );

    expect(
      (await repos.casos.buscarParaPrograma(alerta.caso.idCaso, 'P1'))?.idCaso,
    ).toBe(alerta.caso.idCaso);
    expect(
      (await repos.casos.buscarParaPrograma(academica.caso.idCaso, 'P1'))
        ?.idCaso,
    ).toBe(academica.caso.idCaso);
    expect(
      await repos.casos.buscarParaPrograma(psicosocial.caso.idCaso, 'P1'),
    ).toBeNull();
    // Otro programa: no visible.
    expect(
      await repos.casos.buscarParaPrograma(alerta.caso.idCaso, 'P2'),
    ).toBeNull();
    expect(await repos.casos.buscarParaPrograma('NO-EXISTE', 'P1')).toBeNull();

    const bandeja = (await repos.casos.listarPendientesPorPrograma('P1')).map(
      (c) => c.idCaso,
    );
    expect(bandeja).toEqual(
      expect.arrayContaining([alerta.caso.idCaso, academica.caso.idCaso]),
    );
    expect(bandeja).not.toContain(psicosocial.caso.idCaso);
  });

  it('la académica canalizada a psicología sigue visible (solo su estado) y sale de la bandeja', async () => {
    const academica = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.ACADEMICA,
    );
    academica.caso.canalizar(RutaAtencion.PSICOLOGICA);
    await repos.casos.guardar(academica.caso);
    expect(
      (await repos.casos.buscarParaPrograma(academica.caso.idCaso, 'P1'))?.ruta,
    ).toBe(RutaAtencion.PSICOLOGICA);
    const bandeja = (await repos.casos.listarPendientesPorPrograma('P1')).map(
      (c) => c.idCaso,
    );
    expect(bandeja).not.toContain(academica.caso.idCaso);
  });
});

describe('Trazabilidad (respuesta 10)', () => {
  async function traza(idCaso: string) {
    const [fila] = await fuente.query<
      {
        fecha_canalizacion: Date | null;
        id_jefe: string | null;
        fecha_consentimiento: Date | null;
        id_psicologo_consentimiento: string | null;
      }[]
    >(
      `SELECT fecha_canalizacion, id_jefe, fecha_consentimiento, id_psicologo_consentimiento
       FROM caso_riesgo WHERE id_caso = $1`,
      [idCaso],
    );
    return fila;
  }

  it('la canalización del Jefe fija quién (id_jefe) y cuándo, una sola vez', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r2);
    expect(await traza(caso.idCaso)).toMatchObject({
      fecha_canalizacion: null,
      id_jefe: null,
    });
    caso.canalizar(RutaAtencion.PSICOLOGICA);
    await repos.casos.guardar(caso);
    const primera = await traza(caso.idCaso);
    expect(primera?.id_jefe).toBe('J1');
    expect(primera?.fecha_canalizacion).toBeInstanceOf(Date);
    caso.asignarPsicologo(esc.ps1);
    await repos.casos.guardar(caso);
    expect((await traza(caso.idCaso))?.fecha_canalizacion).toEqual(
      primera?.fecha_canalizacion,
    );
  });

  it('una solicitud psicosocial (ruta desde el nacimiento) no tiene fecha de canalización', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    expect(await traza(caso.idCaso)).toMatchObject({
      fecha_canalizacion: null,
      id_jefe: null,
    });
  });

  it('la confirmación del consentimiento fija quién (el psicólogo asignado) y cuándo', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    caso.asignarPsicologo(esc.ps1);
    await repos.casos.guardar(caso);
    expect(await traza(caso.idCaso)).toMatchObject({
      fecha_consentimiento: null,
      id_psicologo_consentimiento: null,
    });
    caso.confirmarConsentimiento();
    await repos.casos.guardar(caso);
    const fila = await traza(caso.idCaso);
    expect(fila?.id_psicologo_consentimiento).toBe('PS1');
    expect(fila?.fecha_consentimiento).toBeInstanceOf(Date);
  });
});

describe('Bloqueos con espera (respuesta 7, ajuste B)', () => {
  it('la segunda transacción espera a la primera y ve su cambio', async () => {
    const orden: string[] = [];
    const primera = unidad.ejecutar(
      async () => {
        orden.push('primera:inicio');
        await esperar(300);
        orden.push('primera:fin');
      },
      { bloqueos: ['caso:X1'] },
    );
    await esperar(50);
    const segunda = new UnidadTrabajoPersistente(otraFuente).ejecutar(
      async () => {
        orden.push('segunda');
      },
      { bloqueos: ['caso:X1'] },
    );
    await Promise.all([primera, segunda]);
    expect(orden).toEqual(['primera:inicio', 'primera:fin', 'segunda']);
  });

  it('si la espera supera lock_timeout, lanza BloqueoAgotadoError', async () => {
    const corta = new UnidadTrabajoPersistente(otraFuente, 200);
    let liberar: () => void = () => undefined;
    const retenida = unidad.ejecutar(
      () =>
        new Promise<void>((resolver) => {
          liberar = resolver;
        }),
      { bloqueos: ['caso:X2'] },
    );
    await esperar(50);
    const inicio = Date.now();
    await expect(
      corta.ejecutar(async () => undefined, { bloqueos: ['caso:X2'] }),
    ).rejects.toBeInstanceOf(BloqueoAgotadoError);
    expect(Date.now() - inicio).toBeLessThan(2000);
    liberar();
    await retenida;
  });

  it('dos sesiones cruzadas (caso distinto, misma agenda) no se interbloquean', async () => {
    const otra = new UnidadTrabajoPersistente(otraFuente);
    const resultado = await Promise.all([
      unidad.ejecutar(async () => esperar(150).then(() => 'A'), {
        bloqueos: ['caso:C-A', 'agenda:PS1'],
      }),
      otra.ejecutar(async () => esperar(150).then(() => 'B'), {
        bloqueos: ['caso:C-B', 'agenda:PS1'],
      }),
    ]);
    expect(resultado.sort()).toEqual(['A', 'B']);
  });

  it('el espacio de claves no se cruza con el bloqueo de la sincronización (B4)', async () => {
    let liberar: () => void = () => undefined;
    const sincronizacion = unidad.ejecutar(
      () =>
        new Promise<void>((resolver) => {
          liberar = resolver;
        }),
      { bloqueoExclusivo: 'misma-clave' },
    );
    await esperar(50);
    // Misma cadena en el espacio de B7: no espera ni falla.
    await expect(
      new UnidadTrabajoPersistente(otraFuente, 500).ejecutar(async () => 'ok', {
        bloqueos: ['misma-clave'],
      }),
    ).resolves.toBe('ok');
    liberar();
    await sincronizacion;
  });
});

describe('Cita y asesoría en una transacción (B7c)', () => {
  it('si falla después de guardar la cita y la asesoría, se revierten ambas', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    caso.asignarPsicologo(esc.ps1);
    caso.aprobar();
    const cita = caso.programarCita(
      new Date('2027-01-10T15:00:00Z'),
      Modalidad.VIRTUAL,
    );
    await repos.casos.guardar(caso);

    await expect(
      unidad.ejecutar(async (r) => {
        const recargado = await r.casos.buscarPorId(caso.idCaso);
        const actual = recargado?.citas.find((c) => c.idCita === cita.idCita);
        const asesoria = actual!.generarAsesoria(
          TipoAsesoria.ORIENTACION,
          'Obs',
          '',
          true,
          false,
          false,
        );
        await r.citas.guardar(actual!);
        await r.asesorias.guardar(asesoria);
        throw new Error('fallo forzado');
      }),
    ).rejects.toThrow('fallo forzado');

    const recargada = await repos.citas.buscarPorId(cita.idCita);
    expect(recargada?.estado).toBe(EstadoCita.PROGRAMADA);
    expect(recargada?.asesoria).toBeNull();
  });
});

describe('Bandeja del psicólogo sin N+1 (B7c)', () => {
  it('el número de consultas no depende del número de casos', async () => {
    const contador = new ContadorConsultas();
    const contada = await abrirFuenteAplicacion(contador);
    try {
      const casos = new RepositorioPersistenteCasoRiesgo(contada);
      contador.total = 0;
      await casos.listarPendientesRutaPsicologica();
      const antes = contador.total;
      for (let i = 0; i < 12; i++) {
        await casoDeSolicitud(repos, esc.e2, RutaAtencion.PSICOLOGICA);
      }
      contador.total = 0;
      const lista = await casos.listarPendientesRutaPsicologica();
      expect(lista.length).toBeGreaterThanOrEqual(12);
      expect(contador.total).toBeLessThanOrEqual(Math.max(antes, 15));
    } finally {
      await contada.destroy();
    }
  });
});
