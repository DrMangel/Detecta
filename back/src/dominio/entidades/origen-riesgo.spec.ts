import { Alerta } from './alerta';
import { Curso } from './curso';
import { Docente } from './docente';
import { EstadoCaso } from './estado-caso';
import { EstadoOrigen } from './estado-origen';
import { Estudiante } from './estudiante';
import { NivelRiesgo } from './nivel-riesgo';
import { Programa } from './programa';
import { RegistroAcademico } from './registro-academico';
import { Rol } from './rol';
import { RutaAtencion } from './ruta-atencion';
import { SolicitudAcompanamiento } from './solicitud-acompanamiento';

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
const otroCurso = new Curso({
  idCurso: 'C2',
  nombre: 'Física',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [estudiante],
});
const docente = new Docente({
  id: 'D1',
  nombre: 'Docente',
  correo: 'docente@ejemplo.edu.co',
  contrasenaHash: 'hash',
  cursos: [curso],
});
const registro = new RegistroAcademico({
  idRegistro: 'R1',
  nota: 2.5,
  porcentajeAsistencia: 70,
  estudiante,
  curso,
});

describe('Docente y Alerta (R01, sd_CUD03)', () => {
  it('obtenerRol devuelve DOCENTE', () => {
    expect(docente.obtenerRol()).toBe(Rol.DOCENTE);
  });

  it('dicta indica si el curso está asignado al docente', () => {
    expect(docente.dicta(curso)).toBe(true);
    expect(docente.dicta(otroCurso)).toBe(false);
  });

  it('emitirAlerta crea una alerta PENDIENTE sobre el registro', () => {
    const alerta = docente.emitirAlerta(
      registro,
      NivelRiesgo.MEDIO,
      'Inasistencia',
    );
    expect(alerta).toBeInstanceOf(Alerta);
    expect(alerta.estado).toBe(EstadoOrigen.PENDIENTE);
    expect(alerta.estaPendiente()).toBe(true);
    expect(alerta.docente).toBe(docente);
    expect(alerta.obtenerEstudiante()).toBe(estudiante);
  });

  it('emitirAlerta rechaza un registro de un curso que no dicta (ER 3.5.3)', () => {
    const ajeno = new RegistroAcademico({
      idRegistro: 'R2',
      nota: 3,
      porcentajeAsistencia: 90,
      estudiante,
      curso: otroCurso,
    });
    expect(() => docente.emitirAlerta(ajeno, NivelRiesgo.BAJO, 'x')).toThrow(
      /curso asignado/,
    );
  });

  it('emitirAlerta exige la descripción (CUD03 6.a)', () => {
    expect(() =>
      docente.emitirAlerta(registro, NivelRiesgo.ALTO, '  '),
    ).toThrow(/Complete el nivel de riesgo/);
  });

  it('generarCasoRiesgo crea el caso sin ruta, PENDIENTE, no confidencial, y marca la alerta ATENDIDO', () => {
    const alerta = docente.emitirAlerta(
      registro,
      NivelRiesgo.ALTO,
      'Bajo rendimiento',
    );
    const caso = alerta.generarCasoRiesgo();
    expect(caso.ruta).toBeNull();
    expect(caso.estado).toBe(EstadoCaso.PENDIENTE);
    expect(caso.confidencialidad).toBe(false);
    expect(caso.nivelRiesgo).toBe(NivelRiesgo.ALTO);
    expect(caso.motivo).toBe('Bajo rendimiento');
    expect(caso.origen).toBe(alerta);
    expect(alerta.estado).toBe(EstadoOrigen.ATENDIDO);
  });

  it('una alerta genera como máximo un caso', () => {
    const alerta = docente.emitirAlerta(registro, NivelRiesgo.ALTO, 'x');
    alerta.generarCasoRiesgo();
    expect(() => alerta.generarCasoRiesgo()).toThrow(/ya generó/);
  });
});

describe('Estudiante y SolicitudAcompanamiento (R02, sd_CUD02)', () => {
  it('solicitarAcompanamiento crea una solicitud PENDIENTE del estudiante', () => {
    const solicitud = estudiante.solicitarAcompanamiento(
      RutaAtencion.ACADEMICA,
      'Me cuesta Cálculo',
      'Martes',
    );
    expect(solicitud).toBeInstanceOf(SolicitudAcompanamiento);
    expect(solicitud.estaPendiente()).toBe(true);
    expect(solicitud.obtenerEstudiante()).toBe(estudiante);
  });

  it('solicitarAcompanamiento exige el motivo (CUD02 4.a)', () => {
    expect(() =>
      estudiante.solicitarAcompanamiento(RutaAtencion.ACADEMICA, ' ', 'Martes'),
    ).toThrow(/motivo/);
  });

  it('la solicitud psicosocial genera un caso confidencial con ruta PSICOLOGICA', () => {
    const solicitud = estudiante.solicitarAcompanamiento(
      RutaAtencion.PSICOLOGICA,
      'Ansiedad',
      'Lunes',
    );
    const caso = solicitud.generarCasoRiesgo();
    expect(caso.ruta).toBe(RutaAtencion.PSICOLOGICA);
    expect(caso.confidencialidad).toBe(true);
    expect(caso.nivelRiesgo).toBeNull();
    expect(caso.estado).toBe(EstadoCaso.PENDIENTE);
    expect(solicitud.estado).toBe(EstadoOrigen.ATENDIDO);
  });

  it('la solicitud académica genera un caso confidencial sin ruta', () => {
    const caso = estudiante
      .solicitarAcompanamiento(
        RutaAtencion.ACADEMICA,
        'Me cuesta Cálculo',
        'Martes',
      )
      .generarCasoRiesgo();
    expect(caso.ruta).toBeNull();
    expect(caso.confidencialidad).toBe(true);
  });

  it('una solicitud genera como máximo un caso', () => {
    const solicitud = estudiante.solicitarAcompanamiento(
      RutaAtencion.ACADEMICA,
      'x',
      'y',
    );
    solicitud.generarCasoRiesgo();
    expect(() => solicitud.generarCasoRiesgo()).toThrow(/ya generó/);
  });
});
