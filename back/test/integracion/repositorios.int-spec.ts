import type { DataSource } from 'typeorm';
import { Alerta } from '../../src/dominio/entidades/alerta';
import { Curso } from '../../src/dominio/entidades/curso';
import { CasoRiesgo } from '../../src/dominio/entidades/caso-riesgo';
import { Docente } from '../../src/dominio/entidades/docente';
import { EstadoCaso } from '../../src/dominio/entidades/estado-caso';
import { EstadoCita } from '../../src/dominio/entidades/estado-cita';
import { EstadoOrigen } from '../../src/dominio/entidades/estado-origen';
import { EstadoPlan } from '../../src/dominio/entidades/estado-plan';
import { Estudiante } from '../../src/dominio/entidades/estudiante';
import { InformeRiesgo } from '../../src/dominio/entidades/informe-riesgo';
import { JefeDepartamento } from '../../src/dominio/entidades/jefe-departamento';
import { Modalidad } from '../../src/dominio/entidades/modalidad';
import { NivelRiesgo } from '../../src/dominio/entidades/nivel-riesgo';
import { Psicologo } from '../../src/dominio/entidades/psicologo';
import { Rol } from '../../src/dominio/entidades/rol';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
import { SolicitudAcompanamiento } from '../../src/dominio/entidades/solicitud-acompanamiento';
import { TipoAsesoria } from '../../src/dominio/entidades/tipo-asesoria';
import {
  casoDeAlerta,
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
  OTRO_PERIODO,
  PERIODO,
  type Escenario,
  type Repositorios,
} from './escenario';
import {
  abrirFuenteAplicacion,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';

let fuente: DataSource;
let repos: Repositorios;
let esc: Escenario;

async function idJefeDelCaso(idCaso: string): Promise<string | null> {
  const [fila] = await fuente.query(
    'SELECT id_jefe FROM caso_riesgo WHERE id_caso = $1',
    [idCaso],
  );
  return fila.id_jefe;
}

beforeAll(async () => {
  await migrarBasePruebas();
  fuente = await abrirFuenteAplicacion();
  repos = crearRepositorios(fuente);
});

afterAll(async () => {
  await fuente.destroy();
});

beforeEach(async () => {
  await vaciarBasePruebas();
  esc = await crearEscenario(repos);
});

describe('Persona: herencia de tabla única', () => {
  it('reconstruye cada subclase con sus atributos propios', async () => {
    const e1 = await repos.personas.buscarPorId('E1');
    const j1 = await repos.personas.buscarPorId('J1');
    const d1 = await repos.personas.buscarPorId('D1');
    const ps1 = await repos.personas.buscarPorId('PS1');

    expect(e1).toBeInstanceOf(Estudiante);
    expect((e1 as Estudiante).fechaNacimiento).toEqual(new Date(2000, 4, 15));
    expect((e1 as Estudiante).obtenerPrograma().idPrograma).toBe('P1');
    expect(j1).toBeInstanceOf(JefeDepartamento);
    expect((j1 as JefeDepartamento).programa.idPrograma).toBe('P1');
    expect(d1).toBeInstanceOf(Docente);
    expect(ps1).toBeInstanceOf(Psicologo);
    expect(await repos.personas.buscarPorId('NO-EXISTE')).toBeNull();
  });

  it('guarda la columna discriminadora rol por subclase', async () => {
    const filas: { id: string; rol: string }[] = await fuente.query(
      'SELECT id, rol FROM persona ORDER BY id',
    );
    expect(filas).toEqual([
      { id: 'D1', rol: 'DOCENTE' },
      { id: 'E1', rol: 'ESTUDIANTE' },
      { id: 'E2', rol: 'ESTUDIANTE' },
      { id: 'E3', rol: 'ESTUDIANTE' },
      { id: 'J1', rol: 'JEFE_DEPARTAMENTO' },
      { id: 'PS1', rol: 'PSICOLOGO' },
    ]);
  });

  it('escribe y lee contrasenaHash sin que aparezca al serializar', async () => {
    const [fila] = await fuente.query(
      'SELECT contrasena_hash FROM persona WHERE id = $1',
      ['E1'],
    );
    expect(fila.contrasena_hash).toBe('$2b$10$hash-de-prueba-E1');

    const leida = await repos.personas.buscarPorId('E1');
    expect(JSON.stringify(leida)).not.toContain('hash');
    // Se vuelve a guardar lo leído: el hash debe conservarse.
    await repos.personas.guardar(leida as Estudiante);
    const [otra] = await fuente.query(
      'SELECT contrasena_hash FROM persona WHERE id = $1',
      ['E1'],
    );
    expect(otra.contrasena_hash).toBe('$2b$10$hash-de-prueba-E1');
  });

  it('buscarPorCorreo, listarPorRol y buscarJefePorPrograma', async () => {
    expect(
      (await repos.personas.buscarPorCorreo('d1@ejemplo.edu.co'))?.id,
    ).toBe('D1');
    expect(await repos.personas.buscarPorCorreo('nadie@x.co')).toBeNull();
    expect(
      (await repos.personas.listarPorRol(Rol.ESTUDIANTE)).map((p) => p.id),
    ).toEqual(['E1', 'E2', 'E3']);
    expect((await repos.personas.buscarJefePorPrograma('P1'))?.id).toBe('J1');
    expect(await repos.personas.buscarJefePorPrograma('P2')).toBeNull();
  });

  it('guardar(docente) escribe en cascada sus cursos y el docente se reconstruye con ellos', async () => {
    const filas: { id_curso: string; id_docente: string }[] =
      await fuente.query(
        'SELECT id_curso, id_docente FROM curso ORDER BY id_curso',
      );
    expect(filas).toEqual([
      { id_curso: 'C0', id_docente: 'D1' },
      { id_curso: 'C1', id_docente: 'D1' },
    ]);
    const docente = (await repos.personas.buscarPorId('D1')) as Docente;
    const c1 = docente.cursos.find((curso) => curso.idCurso === 'C1');
    expect(
      c1
        ?.obtenerEstudiantes()
        .map((e) => e.id)
        .sort(),
    ).toEqual(['E1', 'E2', 'E3']);
  });
});

describe('listar(criterios) con lista blanca', () => {
  it('filtra por igualdad con AND', async () => {
    const encontrados = await repos.personas.listar(
      new Map([['correo', 'e2@ejemplo.edu.co']]),
    );
    expect(encontrados.map((p) => p.id)).toEqual(['E2']);
    const cursos = await repos.cursos.listar(new Map([['periodo', PERIODO]]));
    expect(cursos.map((c) => c.idCurso)).toEqual(['C1']);
  });

  it('una clave desconocida lanza Error', async () => {
    await expect(
      repos.personas.listar(new Map([['contrasena_hash', 'x']])),
    ).rejects.toThrow('Criterio no permitido en listar(): contrasena_hash');
    await expect(
      repos.casos.listar(new Map([['id_estudiante; DROP TABLE persona', 'x']])),
    ).rejects.toThrow(/Criterio no permitido/);
  });

  it('un valor que no es primitivo lanza Error', async () => {
    await expect(
      repos.personas.listar(new Map([['nombre', { $ne: '' }]])),
    ).rejects.toThrow(/texto, número, booleano o null/);
  });
});

describe('Curso, Cita y Asesoria: guardar solo actualiza (se crean en cascada)', () => {
  it('guardar(curso) actualiza un curso existente', async () => {
    esc.c1.marcarSincronizado(new Date(2026, 10, 17, 2, 0));
    await repos.cursos.guardar(esc.c1);
    const leido = await repos.cursos.buscarPorId('C1');
    expect(leido?.ultimaSincronizacion).toEqual(new Date(2026, 10, 17, 2, 0));
  });

  it('guardar(curso) de un curso que no existe lanza Error', async () => {
    const nuevo = new Curso({
      idCurso: 'C9',
      nombre: 'Nuevo',
      periodo: PERIODO,
      ultimaSincronizacion: null,
      estudiantes: [],
    });
    await expect(repos.cursos.guardar(nuevo)).rejects.toThrow(
      /se crean al guardar su docente/,
    );
  });
});

describe('Alerta y SolicitudAcompanamiento', () => {
  it('reconstruye la alerta con su docente y su registro', async () => {
    const { alerta } = await casoDeAlerta(repos, esc.d1, esc.r1);
    const leida = await repos.alertas.buscarPorId(alerta.idOrigen);
    expect(leida).toBeInstanceOf(Alerta);
    expect(leida?.docente.id).toBe('D1');
    expect(leida?.registro.nota).toBe(2.4);
    expect(leida?.registro.porcentajeAsistencia).toBe(61.5);
    expect(leida?.estado).toBe(EstadoOrigen.ATENDIDO);
    // El repositorio de alertas no devuelve solicitudes y viceversa.
    expect(await repos.solicitudes.buscarPorId(alerta.idOrigen)).toBeNull();
  });

  it('listarPorDocente, listarPorEstudiante y listarPorCurso usan el periodo del curso (D12)', async () => {
    const { alerta } = await casoDeAlerta(repos, esc.d1, esc.r1);
    const { alerta: antigua } = await casoDeAlerta(repos, esc.d1, esc.r0);
    await casoDeAlerta(repos, esc.d1, esc.r3);

    expect(
      (await repos.alertas.listarPorDocente('D1', OTRO_PERIODO)).map(
        (a) => a.idOrigen,
      ),
    ).toEqual([antigua.idOrigen]);
    expect(
      (await repos.alertas.listarPorEstudiante('E1', PERIODO)).map(
        (a) => a.idOrigen,
      ),
    ).toEqual([alerta.idOrigen]);
    // listarPorCurso filtra además por el programa del estudiante (E3 es de P2).
    expect(
      (await repos.alertas.listarPorCurso('C1', PERIODO, 'P1')).map(
        (a) => a.idOrigen,
      ),
    ).toEqual([alerta.idOrigen]);
  });

  it('listarPorEstudiante de solicitudes', async () => {
    const { solicitud } = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.ACADEMICA,
    );
    const lista = await repos.solicitudes.listarPorEstudiante('E2');
    expect(lista).toHaveLength(1);
    expect(lista[0]).toBeInstanceOf(SolicitudAcompanamiento);
    expect(lista[0]?.idOrigen).toBe(solicitud.idOrigen);
  });
});

describe('CasoRiesgo', () => {
  it('reconstruye el caso con su origen, su estudiante y la coherencia entre ambos', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r1);
    const leido = await repos.casos.buscarPorId(caso.idCaso);
    expect(leido).toBeInstanceOf(CasoRiesgo);
    expect(leido?.obtenerEstudiante().id).toBe('E1');
    expect(leido?.origen).toBeInstanceOf(Alerta);
    const origen = leido?.origen;
    expect(origen instanceof Alerta ? origen.docente.id : null).toBe('D1');
    expect(leido?.estado).toBe(EstadoCaso.PENDIENTE);
    expect(leido?.confidencialidad).toBe(false);
  });

  it('listarPendientesPorPrograma: PENDIENTE sin ruta del programa (excluye la solicitud psicosocial)', async () => {
    const { caso: deAlerta } = await casoDeAlerta(repos, esc.d1, esc.r1);
    const { caso: academica } = await casoDeSolicitud(
      repos,
      esc.e2,
      RutaAtencion.ACADEMICA,
    );
    await casoDeSolicitud(repos, esc.e1, RutaAtencion.PSICOLOGICA);
    await casoDeAlerta(repos, esc.d1, esc.r3); // E3 es de P2

    const bandeja = await repos.casos.listarPendientesPorPrograma('P1');
    expect(bandeja.map((c) => c.idCaso).sort()).toEqual(
      [deAlerta.idCaso, academica.idCaso].sort(),
    );
  });

  it('listarPendientesRutaPsicologica: ruta PSICOLOGICA y PENDIENTE', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    await casoDeAlerta(repos, esc.d1, esc.r1);
    const lista = await repos.casos.listarPendientesRutaPsicologica();
    expect(lista.map((c) => c.idCaso)).toEqual([caso.idCaso]);
  });

  describe('id_jefe derivado sin estado (respuesta 4 de Ivan)', () => {
    it('caso de alerta sin ruta: id_jefe NULL', async () => {
      const { caso } = await casoDeAlerta(repos, esc.d1, esc.r1);
      expect(await idJefeDelCaso(caso.idCaso)).toBeNull();
    });

    it('caso de alerta canalizado: id_jefe es el jefe del programa del estudiante', async () => {
      const { caso } = await casoDeAlerta(repos, esc.d1, esc.r1);
      caso.canalizar(RutaAtencion.ACADEMICA);
      await repos.casos.guardar(caso);
      expect(await idJefeDelCaso(caso.idCaso)).toBe('J1');
    });

    it('solicitud académica canalizada a PSICOLOGICA: id_jefe es el jefe', async () => {
      const { caso } = await casoDeSolicitud(
        repos,
        esc.e1,
        RutaAtencion.ACADEMICA,
      );
      caso.canalizar(RutaAtencion.PSICOLOGICA);
      await repos.casos.guardar(caso);
      expect(await idJefeDelCaso(caso.idCaso)).toBe('J1');
    });

    it('solicitud PSICOLOGICA (nace con ruta, no pasa por el jefe): id_jefe NULL', async () => {
      const { caso } = await casoDeSolicitud(
        repos,
        esc.e1,
        RutaAtencion.PSICOLOGICA,
      );
      expect(caso.ruta).toBe(RutaAtencion.PSICOLOGICA);
      expect(await idJefeDelCaso(caso.idCaso)).toBeNull();
    });

    it('caso canalizado de un programa sin jefe configurado: Error y no se guarda', async () => {
      const { caso } = await casoDeAlerta(repos, esc.d1, esc.r3); // E3 → P2
      caso.canalizar(RutaAtencion.ACADEMICA);
      await expect(repos.casos.guardar(caso)).rejects.toThrow(
        'No hay Jefe de Departamento configurado para el programa P2',
      );
      expect((await repos.casos.buscarPorId(caso.idCaso))?.ruta).toBeNull();
    });
  });

  it('rechaza un caso cuyo estudiante no coincide con el de su origen (ajuste B)', async () => {
    const alerta = esc.d1.emitirAlerta(esc.r1, NivelRiesgo.ALTO, 'x');
    await repos.alertas.guardar(alerta);
    const incoherente = new CasoRiesgo({
      idCaso: 'INCOHERENTE',
      fechaCreacion: new Date(),
      motivo: 'x',
      nivelRiesgo: null,
      ruta: null,
      estado: EstadoCaso.PENDIENTE,
      justificacion: '',
      confidencialidad: false,
      consentimientoConfirmado: false,
      estudiante: esc.e2, // la alerta es de E1
      origen: alerta,
      psicologo: null,
      citas: [],
    });
    await expect(repos.casos.guardar(incoherente)).rejects.toThrow(
      /su estudiante \(E2\) no es el de su origen \(E1\)/,
    );
    expect(await repos.casos.buscarPorId('INCOHERENTE')).toBeNull();

    // También al leer: una fila incoherente escrita por fuera del mapeador.
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r2); // de E2
    await fuente.query(
      'UPDATE caso_riesgo SET id_estudiante = $1 WHERE id_caso = $2',
      ['E1', caso.idCaso],
    );
    await expect(repos.casos.buscarPorId(caso.idCaso)).rejects.toThrow(
      /Incoherencia/,
    );
  });

  it('guardar(caso) inserta en cascada citas (id_caso, id_psicologo) y asesorías; cita compartida con la agenda', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    caso.asignarPsicologo(esc.ps1);
    caso.aprobar();
    const cita = caso.programarCita(
      new Date(2026, 10, 20, 9),
      Modalidad.PRESENCIAL,
    );
    await repos.casos.guardar(caso);

    const [fila] = await fuente.query(
      'SELECT id_caso, id_psicologo, estado FROM cita WHERE id_cita = $1',
      [cita.idCita],
    );
    expect(fila).toEqual({
      id_caso: caso.idCaso,
      id_psicologo: 'PS1',
      estado: 'PROGRAMADA',
    });

    const leido = await repos.casos.buscarPorId(caso.idCaso);
    expect(leido?.estado).toBe(EstadoCaso.CITADO);
    // Mapa de identidad: la misma Cita en el caso y en la agenda del psicólogo.
    expect(leido?.psicologo?.citas[0]).toBe(leido?.citas[0]);
    expect(leido?.psicologo?.estaDisponible(new Date(2026, 10, 20, 9))).toBe(
      false,
    );
    expect(
      (await repos.casos.listarPorPsicologo('PS1')).map((c) => c.idCaso),
    ).toEqual([caso.idCaso]);

    // guardar(cita): actualiza la cita y escribe en cascada la asesoría.
    const citaLeida = leido?.citas[0];
    citaLeida?.generarAsesoria(
      TipoAsesoria.ORIENTACION,
      'Observaciones',
      '',
      true,
      false,
      false,
    );
    await repos.citas.guardar(citaLeida!);
    const recargada = await repos.citas.buscarPorId(cita.idCita);
    expect(recargada?.estado).toBe(EstadoCita.CERRADA);
    expect(recargada?.asesoria?.estaCompleta()).toBe(true);

    // Cerrar el caso con la asesoría completa y guardarlo.
    const paraCerrar = await repos.casos.buscarPorId(caso.idCaso);
    expect(paraCerrar?.cerrar()).toBe(true);
    await repos.casos.guardar(paraCerrar!);
    expect((await repos.casos.buscarPorId(caso.idCaso))?.estado).toBe(
      EstadoCaso.CERRADO,
    );
  });

  it('guardar(cita) de una cita que no existe lanza Error', async () => {
    const { caso } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    caso.asignarPsicologo(esc.ps1);
    const cita = caso.programarCita(
      new Date(2026, 10, 21, 9),
      Modalidad.VIRTUAL,
    );
    await expect(repos.citas.guardar(cita)).rejects.toThrow(
      /las citas se crean al guardar su caso/,
    );
  });

  it('listarPorPeriodo: cerrados o archivados de alertas del periodo del curso; sin solicitudes (D12)', async () => {
    const { caso: delPeriodo } = await casoDeAlerta(repos, esc.d1, esc.r1);
    delPeriodo.canalizar(RutaAtencion.PSICOLOGICA);
    delPeriodo.asignarPsicologo(esc.ps1);
    delPeriodo.archivar('No pertinente');
    await repos.casos.guardar(delPeriodo);

    const { caso: otroPeriodo } = await casoDeAlerta(repos, esc.d1, esc.r0);
    otroPeriodo.canalizar(RutaAtencion.PSICOLOGICA);
    otroPeriodo.asignarPsicologo(esc.ps1);
    otroPeriodo.archivar('No pertinente');
    await repos.casos.guardar(otroPeriodo);

    const { caso: solicitud } = await casoDeSolicitud(
      repos,
      esc.e1,
      RutaAtencion.PSICOLOGICA,
    );
    solicitud.asignarPsicologo(esc.ps1);
    solicitud.archivar('No pertinente');
    await repos.casos.guardar(solicitud);

    await casoDeAlerta(repos, esc.d1, esc.r2); // pendiente: no aparece

    const lista = await repos.casos.listarPorPeriodo(PERIODO, 'P1');
    expect(lista.map((c) => c.idCaso)).toEqual([delPeriodo.idCaso]);
  });
});

describe('PlanNivelacion', () => {
  /** Caso de alerta sobre el registro, canalizado a la ruta ACADEMICA. */
  async function casoAcademico(registro = esc.r1) {
    const { caso } = await casoDeAlerta(repos, esc.d1, registro);
    caso.canalizar(RutaAtencion.ACADEMICA);
    await repos.casos.guardar(caso);
    return caso;
  }

  it('guardar(plan): id_jefe derivado, cursos en cascada y reconstrucción', async () => {
    const caso = await casoAcademico();
    const plan = esc.j1.estructurarPlanNivelacion(
      caso,
      [esc.c1],
      'Luis',
      'T01',
      'Semanal',
    );
    await repos.planes.guardar(plan);

    const [fila] = await fuente.query(
      'SELECT id_jefe FROM plan_nivelacion WHERE id_plan = $1',
      [plan.idPlan],
    );
    expect(fila.id_jefe).toBe('J1');
    const leido = await repos.planes.buscarPorId(plan.idPlan);
    expect(leido?.estado).toBe(EstadoPlan.ACTIVO);
    expect(leido?.descripcion).toBe('');
    expect(leido?.cursos.map((c) => c.idCurso)).toEqual(['C1']);
    expect(leido?.obtenerEstudiante().id).toBe('E1');
  });

  it('guardar(plan) de un programa sin jefe configurado lanza Error', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r3); // E3 → P2, sin jefe
    caso.canalizar(RutaAtencion.ACADEMICA); // no se guarda: P2 no tiene jefe
    const plan = esc.j1.estructurarPlanNivelacion(
      caso,
      [esc.c1],
      'Luis',
      'T01',
      'Semanal',
    );
    await expect(repos.planes.guardar(plan)).rejects.toThrow(
      'No hay Jefe de Departamento configurado para el programa P2',
    );
  });

  it('listarPorPeriodo usa el periodo de los cursos que refuerza (D12)', async () => {
    const caso = await casoAcademico();
    const delPeriodo = esc.j1.estructurarPlanNivelacion(
      caso,
      [esc.c1],
      'Luis',
      'T01',
      'S',
    );
    await repos.planes.guardar(delPeriodo);
    const casoAnterior = await casoAcademico(esc.r0);
    const otro = esc.j1.estructurarPlanNivelacion(
      casoAnterior,
      [esc.c0],
      'Ana',
      'T02',
      'S',
    );
    await repos.planes.guardar(otro);

    expect(
      (await repos.planes.listarPorPeriodo(PERIODO, 'P1')).map((p) => p.idPlan),
    ).toEqual([delPeriodo.idPlan]);
    expect(await repos.planes.listarPorPeriodo(PERIODO, 'P2')).toEqual([]);
  });
});

describe('InformeRiesgo', () => {
  it('guarda y reconstruye el informe con los casos y planes que resume', async () => {
    const { caso } = await casoDeAlerta(repos, esc.d1, esc.r1);
    caso.canalizar(RutaAtencion.ACADEMICA);
    await repos.casos.guardar(caso);
    const plan = esc.j1.estructurarPlanNivelacion(
      caso,
      [esc.c1],
      'Luis',
      'T01',
      'S',
    );
    await repos.planes.guardar(plan);

    const informe = new InformeRiesgo({
      idInforme: 'I1',
      fecha: new Date(2026, 10, 17),
      periodo: PERIODO,
      totalAlertas: 0,
      totalCasos: 0,
      totalPlanes: 0,
      resumen: '',
      curso: esc.c1,
      casos: [caso],
      planes: [plan],
      alertas: [caso.origen as Alerta],
    });
    informe.consolidar();
    // B8: un informe nuevo exige programa y autor (migración AutoriaInforme).
    await repos.informes.guardarConAutor(informe, 'P1', esc.j1);

    const leido = await repos.informes.buscarPorId('I1');
    expect(leido?.totalAlertas).toBe(1);
    expect(leido?.totalCasos).toBe(1);
    expect(leido?.totalPlanes).toBe(1);
    expect(leido?.resumen).toBe(informe.resumen);
    expect(leido?.casos.map((c) => c.idCaso)).toEqual([caso.idCaso]);
    expect(leido?.planes[0]?.caso).toBe(leido?.casos[0]);
  });
});
