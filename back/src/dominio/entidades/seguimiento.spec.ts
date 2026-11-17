import { Alerta } from './alerta';
import { Asesoria } from './asesoria';
import { CasoRiesgo } from './caso-riesgo';
import { Cita } from './cita';
import { Curso } from './curso';
import { EstadoCita } from './estado-cita';
import { EstadoPlan } from './estado-plan';
import { Estudiante } from './estudiante';
import { InformeRiesgo } from './informe-riesgo';
import { JefeDepartamento } from './jefe-departamento';
import { Modalidad } from './modalidad';
import { Programa } from './programa';
import { RegistroAcademico } from './registro-academico';
import { RutaAtencion } from './ruta-atencion';
import { TipoAsesoria } from './tipo-asesoria';

const programa = new Programa({
  idPrograma: 'P1',
  nombre: 'Ingeniería de Sistemas',
});
const estudiante = new Estudiante({
  id: 'E1',
  nombre: 'Ana',
  correo: 'ana@ejemplo.edu.co',
  contrasenaHash: 'hash',
  fechaNacimiento: new Date(2000, 0, 1),
  programa,
});
const curso = new Curso({
  idCurso: 'C1',
  nombre: 'Cálculo',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [estudiante],
});
const jefe = new JefeDepartamento({
  id: 'J1',
  nombre: 'Jefe',
  correo: 'jefe@ejemplo.edu.co',
  contrasenaHash: 'hash',
  programa,
});

function casoAcademico(): CasoRiesgo {
  const caso = estudiante
    .solicitarAcompanamiento(
      RutaAtencion.ACADEMICA,
      'Me cuesta Cálculo',
      'Martes',
    )
    .generarCasoRiesgo();
  caso.canalizar(RutaAtencion.ACADEMICA);
  return caso;
}

function citaProgramada(): Cita {
  return new Cita({
    idCita: 'CI1',
    fechaHora: new Date(2026, 10, 20, 9),
    modalidad: Modalidad.PRESENCIAL,
    estado: EstadoCita.PROGRAMADA,
    asesoria: null,
  });
}

describe('RegistroAcademico (ER Tabla 2)', () => {
  const base = { idRegistro: 'R1', estudiante, curso };

  it('acepta los extremos de los rangos', () => {
    expect(
      () =>
        new RegistroAcademico({ ...base, nota: 0, porcentajeAsistencia: 100 }),
    ).not.toThrow();
    expect(
      () =>
        new RegistroAcademico({ ...base, nota: 5, porcentajeAsistencia: 0 }),
    ).not.toThrow();
  });

  it('rechaza una nota fuera de 0.00 a 5.00', () => {
    expect(
      () =>
        new RegistroAcademico({
          ...base,
          nota: 5.01,
          porcentajeAsistencia: 50,
        }),
    ).toThrow(/nota/);
    expect(
      () =>
        new RegistroAcademico({
          ...base,
          nota: -0.1,
          porcentajeAsistencia: 50,
        }),
    ).toThrow(/nota/);
  });

  it('rechaza una asistencia fuera de 0.00 a 100.00', () => {
    expect(
      () =>
        new RegistroAcademico({
          ...base,
          nota: 3,
          porcentajeAsistencia: 100.5,
        }),
    ).toThrow(/asistencia/);
  });
});

describe('Cita y Asesoria (sd_CUD06, CUD08)', () => {
  it('reprogramar cambia la fecha y deja la cita REPROGRAMADA', () => {
    const cita = citaProgramada();
    const nueva = new Date(2026, 10, 21, 10);
    cita.reprogramar(nueva);
    expect(cita.estado).toBe(EstadoCita.REPROGRAMADA);
    expect(cita.fechaHora.getTime()).toBe(nueva.getTime());
  });

  it('generarAsesoria crea la asesoría y cierra la cita, aun sin asistencia', () => {
    const cita = citaProgramada();
    const asesoria = cita.generarAsesoria(
      TipoAsesoria.ORIENTACION,
      'No asistió',
      '',
      false,
      true,
      false,
    );
    expect(asesoria).toBeInstanceOf(Asesoria);
    expect(asesoria.asistencia).toBe(false);
    expect(cita.estado).toBe(EstadoCita.CERRADA);
    expect(cita.asesoria).toBe(asesoria);
  });

  it('una cita cerrada no se reprograma ni genera otra asesoría', () => {
    const cita = citaProgramada();
    cita.generarAsesoria(
      TipoAsesoria.ORIENTACION,
      'Obs',
      '',
      true,
      false,
      false,
    );
    expect(() => cita.reprogramar(new Date())).toThrow(/cerrada/);
    expect(() =>
      cita.generarAsesoria(
        TipoAsesoria.SEGUIMIENTO,
        'Obs',
        '',
        true,
        false,
        false,
      ),
    ).toThrow(/cerrada/);
  });

  it('estaCompleta exige observaciones y no acuerdos (ER R06)', () => {
    const completa = citaProgramada().generarAsesoria(
      TipoAsesoria.ORIENTACION,
      'Observaciones',
      '',
      true,
      false,
      false,
    );
    const incompleta = citaProgramada().generarAsesoria(
      TipoAsesoria.ORIENTACION,
      '   ',
      'Acuerdos',
      true,
      false,
      false,
    );
    expect(completa.estaCompleta()).toBe(true);
    expect(incompleta.estaCompleta()).toBe(false);
  });
});

describe('JefeDepartamento y PlanNivelacion (R04, CUD05)', () => {
  it('estructura un plan ACTIVO con descripción vacía (D10)', () => {
    const caso = casoAcademico();
    const plan = jefe.estructurarPlanNivelacion(
      caso,
      [curso],
      'Luis',
      'T01',
      'Semanal',
    );
    expect(plan.estado).toBe(EstadoPlan.ACTIVO);
    expect(plan.estaActivo()).toBe(true);
    expect(plan.descripcion).toBe('');
    expect(plan.caso).toBe(caso);
    expect(plan.obtenerEstudiante()).toBe(estudiante);
    expect(plan.cursos).toEqual([curso]);
  });

  it('exige el nombre y el código del tutor (CUD05 5.a)', () => {
    expect(() =>
      jefe.estructurarPlanNivelacion(
        casoAcademico(),
        [curso],
        '',
        'T01',
        'Semanal',
      ),
    ).toThrow(/tutor/);
    expect(() =>
      jefe.estructurarPlanNivelacion(
        casoAcademico(),
        [curso],
        'Luis',
        ' ',
        'Semanal',
      ),
    ).toThrow(/tutor/);
  });

  it('exige al menos un curso (refuerza 1..*)', () => {
    expect(() =>
      jefe.estructurarPlanNivelacion(
        casoAcademico(),
        [],
        'Luis',
        'T01',
        'Semanal',
      ),
    ).toThrow(/al menos un curso/);
  });

  it('exige un caso con ruta ACADEMICA', () => {
    const casoPsicologico = estudiante
      .solicitarAcompanamiento(RutaAtencion.PSICOLOGICA, 'Ansiedad', 'Lunes')
      .generarCasoRiesgo();
    expect(() =>
      jefe.estructurarPlanNivelacion(
        casoPsicologico,
        [curso],
        'Luis',
        'T01',
        'Semanal',
      ),
    ).toThrow(/ACADEMICA/);
  });

  it('finalizar deja el plan FINALIZADO y no se repite', () => {
    const plan = jefe.estructurarPlanNivelacion(
      casoAcademico(),
      [curso],
      'Luis',
      'T01',
      'Semanal',
    );
    plan.finalizar();
    expect(plan.estado).toBe(EstadoPlan.FINALIZADO);
    expect(plan.estaActivo()).toBe(false);
    expect(() => plan.finalizar()).toThrow(/finalizado/);
  });
});

describe('InformeRiesgo.consolidar (sd_CUD10)', () => {
  it('calcula los tres totales y el resumen provisional', () => {
    const caso = casoAcademico();
    const plan = jefe.estructurarPlanNivelacion(
      caso,
      [curso],
      'Luis',
      'T01',
      'Semanal',
    );
    const alertas = [{} as Alerta, {} as Alerta];
    const informe = new InformeRiesgo({
      idInforme: 'I1',
      fecha: new Date(2026, 10, 16),
      periodo: '2026-2',
      totalAlertas: 0,
      totalCasos: 0,
      totalPlanes: 0,
      resumen: '',
      curso,
      casos: [caso],
      planes: [plan],
      alertas,
    });
    informe.consolidar();
    expect(informe.totalAlertas).toBe(2);
    expect(informe.totalCasos).toBe(1);
    expect(informe.totalPlanes).toBe(1);
    expect(informe.resumen).toBe(
      'Alertas: 2. Casos: 1. Planes de nivelación: 1.',
    );
  });
});
