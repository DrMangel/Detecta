import type { DataSource } from 'typeorm';
import { EstadoCaso } from '../../src/dominio/entidades/estado-caso';
import { JefeDepartamento } from '../../src/dominio/entidades/jefe-departamento';
import { NivelRiesgo } from '../../src/dominio/entidades/nivel-riesgo';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
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
 * Persistencia de B6 contra detecta_pruebas:
 * - origen y caso en una sola transacción (respuesta 5, ER 3.7 a);
 * - estado derivado del caso en una sola consulta, sin N+1 (ajuste A);
 * - programa sin jefe (ajuste B);
 * - matrícula activa con listar(idEstudiante) (D21).
 */

let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
let unidad: UnidadTrabajoPersistente;

async function contar(tabla: 'origen_riesgo' | 'caso_riesgo'): Promise<number> {
  const [fila] = await fuente.query<{ total: string }[]>(
    `SELECT count(*) AS total FROM ${tabla}`,
  );
  return Number(fila?.total);
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

describe('UnidadTrabajo con alertas, solicitudes y casos (respuesta 5)', () => {
  it('alerta y caso se confirman juntos', async () => {
    const antes = [await contar('origen_riesgo'), await contar('caso_riesgo')];
    const { alerta, caso } = await unidad.ejecutar(async (r) => {
      const nueva = esc.d1.emitirAlerta(
        esc.r1,
        NivelRiesgo.MEDIO,
        'Inasistencias',
      );
      const casoNuevo = nueva.generarCasoRiesgo();
      await r.alertas.guardar(nueva);
      await r.casos.guardar(casoNuevo);
      return { alerta: nueva, caso: casoNuevo };
    });
    expect(await contar('origen_riesgo')).toBe((antes[0] ?? 0) + 1);
    expect(await contar('caso_riesgo')).toBe((antes[1] ?? 0) + 1);
    expect((await repos.casos.buscarPorId(caso.idCaso))?.origen.idOrigen).toBe(
      alerta.idOrigen,
    );
  });

  it('si falla el caso, la alerta guardada antes se revierte (ER 3.7 a)', async () => {
    const antes = await contar('origen_riesgo');
    let idOrigen = '';
    await expect(
      unidad.ejecutar(async (r) => {
        const nueva = esc.d1.emitirAlerta(esc.r1, NivelRiesgo.ALTO, 'x');
        idOrigen = nueva.idOrigen;
        await r.alertas.guardar(nueva);
        // Falla real de la BD: el caso de otra alerta, cuyo origen no se
        // guardó, viola la clave foránea id_origen.
        const huerfana = esc.d1.emitirAlerta(esc.r1, NivelRiesgo.BAJO, 'y');
        await r.casos.guardar(huerfana.generarCasoRiesgo());
      }),
    ).rejects.toThrow();
    expect(await contar('origen_riesgo')).toBe(antes);
    expect(await repos.alertas.buscarPorId(idOrigen)).toBeNull();
  });

  it('si falla después de guardar solicitud y caso, se revierten ambos', async () => {
    const antes = [await contar('origen_riesgo'), await contar('caso_riesgo')];
    await expect(
      unidad.ejecutar(async (r) => {
        const nueva = esc.e1.solicitarAcompanamiento(
          RutaAtencion.ACADEMICA,
          'Apoyo',
          '',
        );
        await r.solicitudes.guardar(nueva);
        await r.casos.guardar(nueva.generarCasoRiesgo());
        throw new Error('fallo forzado tras guardar');
      }),
    ).rejects.toThrow('fallo forzado tras guardar');
    expect([
      await contar('origen_riesgo'),
      await contar('caso_riesgo'),
    ]).toEqual(antes);
  });

  it('D21: registros.listar(idEstudiante) encuentra los registros del estudiante', async () => {
    const r = await repos.registros.listar(new Map([['idEstudiante', 'E1']]));
    expect(r.map((x) => x.idRegistro).sort()).toEqual(['R0', 'R1']);
    expect(
      await repos.registros.listar(new Map([['idEstudiante', 'NADIE']])),
    ).toEqual([]);
  });
});

describe('listarEstadosPorOrigen: estado derivado del caso (ajuste A)', () => {
  it('caso pendiente, canalizado y cerrado', async () => {
    const pendiente = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.ACADEMICA,
    );
    const canalizado = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.ACADEMICA,
    );
    canalizado.caso.canalizar(RutaAtencion.ACADEMICA);
    await repos.casos.guardar(canalizado.caso);
    const cerrado = await casoDeAlerta(repos, esc.d1, esc.r2);
    // El cierre real exige asesoría completa (B7); aquí solo importa la lectura.
    await fuente.query(
      `UPDATE caso_riesgo SET estado = 'CERRADO' WHERE id_caso = $1`,
      [cerrado.caso.idCaso],
    );

    const estados = await repos.casos.listarEstadosPorOrigen([
      pendiente.solicitud.idOrigen,
      canalizado.solicitud.idOrigen,
      cerrado.alerta.idOrigen,
      'SIN-CASO',
    ]);
    expect(estados.get(pendiente.solicitud.idOrigen)).toEqual({
      estado: EstadoCaso.PENDIENTE,
      canalizado: false,
    });
    expect(estados.get(canalizado.solicitud.idOrigen)).toEqual({
      estado: EstadoCaso.EN_NIVELACION,
      canalizado: true,
    });
    expect(estados.get(cerrado.alerta.idOrigen)).toEqual({
      estado: EstadoCaso.CERRADO,
      canalizado: false,
    });
    expect(estados.has('SIN-CASO')).toBe(false);
    // El estado guardado del origen no cambia (regla de B1).
    const [fila] = await fuente.query<{ estado: string }[]>(
      'SELECT estado FROM origen_riesgo WHERE id_origen = $1',
      [pendiente.solicitud.idOrigen],
    );
    expect(fila?.estado).toBe('ATENDIDO');
  });

  it('D27: canalizada a psicología sigue PENDIENTE en el caso pero se informa canalizada; la psicosocial nace sin canalización', async () => {
    const academica = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.ACADEMICA,
    );
    academica.caso.canalizar(RutaAtencion.PSICOLOGICA);
    await repos.casos.guardar(academica.caso);
    const psicosocial = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.PSICOLOGICA,
    );
    const estados = await repos.casos.listarEstadosPorOrigen([
      academica.solicitud.idOrigen,
      psicosocial.solicitud.idOrigen,
    ]);
    expect(estados.get(academica.solicitud.idOrigen)).toEqual({
      estado: EstadoCaso.PENDIENTE,
      canalizado: true,
    });
    expect(estados.get(psicosocial.solicitud.idOrigen)).toEqual({
      estado: EstadoCaso.PENDIENTE,
      canalizado: false,
    });
  });

  it('sin N+1: una sola consulta, sea cual sea el número de orígenes', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      ids.push(
        (await casoDeSolicitud(repos, esc.e1, RutaAtencion.ACADEMICA)).solicitud
          .idOrigen,
      );
    }
    const contador = new ContadorConsultas();
    const fuenteContada = await abrirFuenteAplicacion(contador);
    try {
      const casos = new RepositorioPersistenteCasoRiesgo(fuenteContada);
      contador.total = 0;
      expect((await casos.listarEstadosPorOrigen(ids.slice(0, 3))).size).toBe(
        3,
      );
      const conTres = contador.total;
      contador.total = 0;
      expect((await casos.listarEstadosPorOrigen(ids)).size).toBe(30);
      expect(contador.total).toBe(conTres);
      expect(conTres).toBe(1);
      contador.total = 0;
      expect((await casos.listarEstadosPorOrigen([])).size).toBe(0);
      expect(contador.total).toBe(0);
    } finally {
      await fuenteContada.destroy();
    }
  });
});

describe('Programa sin jefe (respuesta 8, ajuste B)', () => {
  it('el caso se guarda con id_jefe NULL y aparece en la bandeja del programa cuando se asigna jefe', async () => {
    // E3 cursa P2, que no tiene jefe; R3 es de C1, que dicta D1.
    const { caso } = await unidad.ejecutar(async (r) => {
      const alerta = esc.d1.emitirAlerta(esc.r3, NivelRiesgo.ALTO, 'Riesgo');
      const nuevo = alerta.generarCasoRiesgo();
      await r.alertas.guardar(alerta);
      await r.casos.guardar(nuevo);
      expect(await r.personas.buscarJefePorPrograma('P2')).toBeNull();
      return { caso: nuevo };
    });
    const [fila] = await fuente.query<{ id_jefe: string | null }[]>(
      'SELECT id_jefe FROM caso_riesgo WHERE id_caso = $1',
      [caso.idCaso],
    );
    expect(fila?.id_jefe).toBeNull();

    // D17: al configurar un jefe para P2, el caso está en su bandeja, porque
    // la bandeja se calcula por el programa del estudiante, no por id_jefe.
    await repos.personas.guardar(
      new JefeDepartamento({
        id: 'J2',
        nombre: 'Jefe Dos',
        correo: 'j2@ejemplo.edu.co',
        contrasenaHash: '$2b$10$hash-jefe-2',
        programa: esc.p2,
      }),
    );
    const bandeja = await repos.casos.listarPendientesPorPrograma('P2');
    expect(bandeja.map((c) => c.idCaso)).toContain(caso.idCaso);
  });
});
