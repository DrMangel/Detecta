import type { DataSource } from 'typeorm';
import {
  TipoEventoCaso,
  type EventoCaso,
} from '../../src/aplicacion/contratos/registro-eventos-caso';
import type { CasoRiesgo } from '../../src/dominio/entidades/caso-riesgo';
import type { Cita } from '../../src/dominio/entidades/cita';
import { Modalidad } from '../../src/dominio/entidades/modalidad';
import type { PlanNivelacion } from '../../src/dominio/entidades/plan-nivelacion';
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
 * Trazabilidad del caso (B9; ER 1.3.4, CUD04): tabla evento_caso de solo
 * inserción, contra detecta_pruebas y con la conexión de la aplicación
 * (detecta_app).
 */

let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;
let unidad: UnidadTrabajoPersistente;
/** Caso psicológico de PS1 con una cita. */
let caso: CasoRiesgo;
let cita: Cita;
/** Plan de un caso académico de E1. */
let plan: PlanNivelacion;

interface FilaEvento {
  id_caso: string;
  id_actor: string;
  tipo: string;
  ocurrido_en: Date;
  id_plan: string | null;
  id_cita: string | null;
  fecha_hora_anterior: Date | null;
  fecha_hora_nueva: Date | null;
  modalidad_anterior: string | null;
  modalidad_nueva: string | null;
}

async function eventos(): Promise<FilaEvento[]> {
  return fuente.query(
    `SELECT id_caso, id_actor, tipo, ocurrido_en, id_plan, id_cita,
            fecha_hora_anterior, fecha_hora_nueva, modalidad_anterior,
            modalidad_nueva
     FROM evento_caso ORDER BY ocurrido_en, tipo`,
  );
}

const SIN_DATOS = {
  id_plan: null,
  id_cita: null,
  fecha_hora_anterior: null,
  fecha_hora_nueva: null,
  modalidad_anterior: null,
  modalidad_nueva: null,
};

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
  ({ caso } = await casoDeSolicitud(repos, esc.e1, RutaAtencion.PSICOLOGICA));
  caso.asignarPsicologo(esc.ps1);
  caso.aprobar();
  cita = caso.programarCita(
    new Date('2026-12-01T15:00:00Z'),
    Modalidad.PRESENCIAL,
  );
  await repos.casos.guardar(caso);

  const { caso: academico } = await casoDeSolicitud(
    repos,
    esc.e1,
    RutaAtencion.ACADEMICA,
  );
  academico.canalizar(RutaAtencion.ACADEMICA);
  await repos.casos.guardar(academico);
  plan = esc.j1.estructurarPlanNivelacion(academico, [esc.c1], 'T', 'T1', '');
  await repos.planes.guardar(plan);
});

describe('RegistroEventosCaso (adaptador)', () => {
  it('inserta cada tipo con sus columnas y nada más; ocurrido_en lo pone PostgreSQL', async () => {
    const [{ antes }] = (await fuente.query('SELECT now() AS antes')) as [
      { antes: Date },
    ];
    const lote: EventoCaso[] = [
      {
        tipo: TipoEventoCaso.DICTAMEN_APROBADO,
        idCaso: caso.idCaso,
        idActor: 'PS1',
      },
      {
        tipo: TipoEventoCaso.CITA_PROGRAMADA,
        idCaso: caso.idCaso,
        idActor: 'PS1',
        idCita: cita.idCita,
      },
      {
        tipo: TipoEventoCaso.CITA_REPROGRAMADA,
        idCaso: caso.idCaso,
        idActor: 'PS1',
        idCita: cita.idCita,
        fechaHoraAnterior: new Date('2026-12-01T15:00:00Z'),
        fechaHoraNueva: new Date('2026-12-02T15:00:00Z'),
        modalidadAnterior: Modalidad.PRESENCIAL,
        modalidadNueva: Modalidad.VIRTUAL,
      },
      {
        tipo: TipoEventoCaso.CASO_CERRADO,
        idCaso: caso.idCaso,
        idActor: 'PS1',
      },
      {
        tipo: TipoEventoCaso.PLAN_FINALIZADO,
        idCaso: plan.caso.idCaso,
        idActor: 'J1',
        idPlan: plan.idPlan,
      },
    ];
    await unidad.ejecutar(async (r) => {
      for (const evento of lote) {
        await r.eventos.registrar(evento);
      }
    });

    const filas = await eventos();
    expect(filas).toHaveLength(5);
    const porTipo = new Map(filas.map((fila) => [fila.tipo, fila]));
    expect(porTipo.get('DICTAMEN_APROBADO')).toMatchObject({
      id_caso: caso.idCaso,
      id_actor: 'PS1',
      ...SIN_DATOS,
    });
    expect(porTipo.get('CASO_CERRADO')).toMatchObject(SIN_DATOS);
    expect(porTipo.get('CITA_PROGRAMADA')).toMatchObject({
      ...SIN_DATOS,
      id_cita: cita.idCita,
    });
    expect(porTipo.get('CITA_REPROGRAMADA')).toMatchObject({
      id_cita: cita.idCita,
      id_plan: null,
      fecha_hora_anterior: new Date('2026-12-01T15:00:00Z'),
      fecha_hora_nueva: new Date('2026-12-02T15:00:00Z'),
      modalidad_anterior: 'PRESENCIAL',
      modalidad_nueva: 'VIRTUAL',
    });
    expect(porTipo.get('PLAN_FINALIZADO')).toMatchObject({
      ...SIN_DATOS,
      id_caso: plan.caso.idCaso,
      id_actor: 'J1',
      id_plan: plan.idPlan,
    });
    // Misma transacción: todos con la misma hora, la de la transacción.
    const horas = new Set(filas.map((fila) => fila.ocurrido_en.getTime()));
    expect(horas.size).toBe(1);
    expect(filas[0]!.ocurrido_en.getTime()).toBeGreaterThanOrEqual(
      antes.getTime(),
    );
  });

  it('se revierte junto con la acción ante un fallo forzado', async () => {
    await expect(
      unidad.ejecutar(async (r) => {
        cita.reprogramar(new Date('2026-12-02T15:00:00Z'), Modalidad.VIRTUAL);
        await r.citas.guardar(cita);
        await r.eventos.registrar({
          tipo: TipoEventoCaso.CITA_REPROGRAMADA,
          idCaso: caso.idCaso,
          idActor: 'PS1',
          idCita: cita.idCita,
          fechaHoraAnterior: new Date('2026-12-01T15:00:00Z'),
          fechaHoraNueva: new Date('2026-12-02T15:00:00Z'),
          modalidadAnterior: Modalidad.PRESENCIAL,
          modalidadNueva: Modalidad.VIRTUAL,
        });
        throw new Error('fallo forzado');
      }),
    ).rejects.toThrow('fallo forzado');
    expect(await eventos()).toEqual([]);
    const [fila] = await fuente.query<
      { fecha_hora: Date; modalidad: string }[]
    >('SELECT fecha_hora, modalidad FROM cita WHERE id_cita = $1', [
      cita.idCita,
    ]);
    expect(fila).toEqual({
      fecha_hora: new Date('2026-12-01T15:00:00Z'),
      modalidad: 'PRESENCIAL',
    });
  });

  it('la tabla no tiene columnas de contenido (motivo, justificación, observaciones, acuerdos)', async () => {
    const columnas: { column_name: string }[] = await fuente.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'evento_caso' ORDER BY ordinal_position`,
    );
    expect(columnas.map((c) => c.column_name)).toEqual([
      'id_evento',
      'id_caso',
      'id_actor',
      'tipo',
      'ocurrido_en',
      'id_plan',
      'id_cita',
      'fecha_hora_anterior',
      'fecha_hora_nueva',
      'modalidad_anterior',
      'modalidad_nueva',
    ]);
  });
});

describe('evento_caso: solo inserción para detecta_app', () => {
  beforeEach(async () => {
    await unidad.ejecutar((r) =>
      r.eventos.registrar({
        tipo: TipoEventoCaso.DICTAMEN_APROBADO,
        idCaso: caso.idCaso,
        idActor: 'PS1',
      }),
    );
  });

  it('privilegios: SELECT e INSERT; sin UPDATE, DELETE ni TRUNCATE', async () => {
    const [fila] = await fuente.query(
      `SELECT ${['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']
        .map(
          (p) =>
            `has_table_privilege('detecta_app', 'public.evento_caso', '${p}') AS "${p.toLowerCase()}"`,
        )
        .join(', ')}`,
    );
    expect(fila).toEqual({
      select: true,
      insert: true,
      update: false,
      delete: false,
      truncate: false,
    });
  });

  it.each([
    ["UPDATE evento_caso SET id_actor = 'J1'"],
    ['DELETE FROM evento_caso'],
  ])('%s real: permission denied y la fila no cambia', async (sql) => {
    await expect(fuente.query(sql)).rejects.toThrow(
      'permission denied for table evento_caso',
    );
    expect(await eventos()).toEqual([
      expect.objectContaining({ id_actor: 'PS1', tipo: 'DICTAMEN_APROBADO' }),
    ]);
  });
});

describe('evento_caso: CHECKs por tipo', () => {
  const INSERTAR = `
    INSERT INTO evento_caso (id_evento, id_caso, id_actor, tipo, id_plan,
      id_cita, fecha_hora_anterior, fecha_hora_nueva, modalidad_anterior,
      modalidad_nueva)
    VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)`;
  const F1 = '2026-12-01T15:00:00Z';
  const F2 = '2026-12-02T15:00:00Z';

  it.each([
    ['tipo desconocido', 'OTRO', null, null, null, null, null, null, /check/],
    [
      'PLAN_FINALIZADO sin plan',
      'PLAN_FINALIZADO',
      null,
      null,
      null,
      null,
      null,
      null,
      /ck_evento_plan/,
    ],
    [
      'CASO_CERRADO con cita',
      'CASO_CERRADO',
      null,
      'CITA',
      null,
      null,
      null,
      null,
      /ck_evento_cita/,
    ],
    [
      'CITA_REPROGRAMADA sin la modalidad anterior',
      'CITA_REPROGRAMADA',
      null,
      'CITA',
      F1,
      F2,
      null,
      'VIRTUAL',
      /ck_evento_reprogramacion/,
    ],
    [
      'CITA_PROGRAMADA con fechas de reprogramación',
      'CITA_PROGRAMADA',
      null,
      'CITA',
      F1,
      F2,
      'PRESENCIAL',
      'VIRTUAL',
      /ck_evento_reprogramacion/,
    ],
    [
      'modalidad fuera del enumerado',
      'CITA_REPROGRAMADA',
      null,
      'CITA',
      F1,
      F2,
      'PRESENCIAL',
      'TELEFONICA',
      /check/,
    ],
  ])(
    '%s: se rechaza',
    async (
      _nombre,
      tipo,
      plano,
      citaMarcada,
      anterior,
      nueva,
      modAnterior,
      modNueva,
      error,
    ) => {
      await expect(
        fuente.query(INSERTAR, [
          caso.idCaso,
          'PS1',
          tipo,
          plano,
          citaMarcada === 'CITA' ? cita.idCita : null,
          anterior,
          nueva,
          modAnterior,
          modNueva,
        ]),
      ).rejects.toThrow(error);
      expect(await eventos()).toEqual([]);
    },
  );

  it('id_caso e id_actor obligatorios y con llave foránea', async () => {
    await expect(
      fuente.query(INSERTAR, [
        'NO-EXISTE',
        'PS1',
        'CASO_CERRADO',
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
    ).rejects.toThrow(/foreign key/);
    await expect(
      fuente.query(INSERTAR, [
        caso.idCaso,
        null,
        'CASO_CERRADO',
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
    ).rejects.toThrow(/null value in column "id_actor"/);
  });
});
