import { Alerta } from './alerta';
import { Asesoria } from './asesoria';
import { CasoRiesgo, type PropiedadesCasoRiesgo } from './caso-riesgo';
import { Curso } from './curso';
import { Docente } from './docente';
import { EstadoCaso } from './estado-caso';
import { EstadoCita } from './estado-cita';
import { Estudiante } from './estudiante';
import { Modalidad } from './modalidad';
import { NivelRiesgo } from './nivel-riesgo';
import { Programa } from './programa';
import { Psicologo } from './psicologo';
import { RegistroAcademico } from './registro-academico';
import { RutaAtencion } from './ruta-atencion';
import { SolicitudAcompanamiento } from './solicitud-acompanamiento';
import { TipoAsesoria } from './tipo-asesoria';

const HOY = new Date(2026, 10, 16);
const programa = new Programa({
  idPrograma: 'P1',
  nombre: 'Ingeniería de Sistemas',
});

function crearEstudiante(fechaNacimiento = new Date(2000, 0, 1)): Estudiante {
  return new Estudiante({
    id: 'E1',
    nombre: 'Ana',
    correo: 'ana@ejemplo.edu.co',
    contrasenaHash: 'hash',
    fechaNacimiento,
    programa,
  });
}

function crearPsicologo(id = 'PS1'): Psicologo {
  return new Psicologo({
    id,
    nombre: 'Psicólogo',
    correo: `${id}@ejemplo.edu.co`,
    contrasenaHash: 'hash',
    citas: [],
  });
}

function casoDeAlerta(estudiante = crearEstudiante()): {
  caso: CasoRiesgo;
  alerta: Alerta;
  docente: Docente;
} {
  const curso = new Curso({
    idCurso: 'C1',
    nombre: 'Cálculo',
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
    nota: 2.1,
    porcentajeAsistencia: 60,
    estudiante,
    curso,
  });
  const alerta = docente.emitirAlerta(
    registro,
    NivelRiesgo.ALTO,
    'Bajo rendimiento',
  );
  return { caso: alerta.generarCasoRiesgo(), alerta, docente };
}

function casoDeSolicitud(
  tipoApoyo: RutaAtencion,
  estudiante = crearEstudiante(),
): CasoRiesgo {
  return estudiante
    .solicitarAcompanamiento(tipoApoyo, 'Necesito apoyo', 'Lunes en la tarde')
    .generarCasoRiesgo();
}

/** Caso psicológico con psicólogo asignado, listo para programar citas. */
function casoEnEvaluacion(estudiante = crearEstudiante()): CasoRiesgo {
  const caso = casoDeSolicitud(RutaAtencion.PSICOLOGICA, estudiante);
  caso.asignarPsicologo(crearPsicologo());
  return caso;
}

function propiedadesValidas(): PropiedadesCasoRiesgo {
  const { caso } = casoDeAlerta();
  return {
    idCaso: 'X',
    fechaCreacion: HOY,
    motivo: 'Motivo',
    nivelRiesgo: null,
    ruta: null,
    estado: EstadoCaso.PENDIENTE,
    justificacion: '',
    confidencialidad: false,
    consentimientoConfirmado: false,
    estudiante: caso.obtenerEstudiante(),
    origen: caso.origen,
    psicologo: null,
    citas: [],
  };
}

describe('CasoRiesgo', () => {
  describe('integridad D7', () => {
    it('D7: no se crea sin motivo', () => {
      expect(
        () => new CasoRiesgo({ ...propiedadesValidas(), motivo: '  ' }),
      ).toThrow(/motivo/);
    });

    it('D7: no se crea sin estudiante', () => {
      const sinEstudiante = {
        ...propiedadesValidas(),
        estudiante: null,
      } as unknown as PropiedadesCasoRiesgo;
      expect(() => new CasoRiesgo(sinEstudiante)).toThrow(/estudiante/);
    });

    it('D7: no se crea sin origen', () => {
      const sinOrigen = {
        ...propiedadesValidas(),
        origen: undefined,
      } as unknown as PropiedadesCasoRiesgo;
      expect(() => new CasoRiesgo(sinOrigen)).toThrow(/exactamente un origen/);
    });

    it('D7: el caso no tiene relación directa con Docente', () => {
      const { caso } = casoDeAlerta();
      expect('docente' in caso).toBe(false);
      expect(Object.keys(propiedadesValidas())).not.toContain('docente');
    });

    it('D7: el docente solo se conoce a través de la Alerta que originó el caso', () => {
      const { caso, docente } = casoDeAlerta();
      expect(caso.origen).toBeInstanceOf(Alerta);
      expect((caso.origen as Alerta).docente).toBe(docente);
    });

    it('D7: un caso nacido de una solicitud voluntaria no permite llegar a ningún docente', () => {
      const caso = casoDeSolicitud(RutaAtencion.ACADEMICA);
      expect(caso.origen).toBeInstanceOf(SolicitudAcompanamiento);
      expect('docente' in caso.origen).toBe(false);
    });

    it('D7: el caso pertenece al estudiante de su único origen', () => {
      const estudiante = crearEstudiante();
      const caso = casoDeSolicitud(RutaAtencion.PSICOLOGICA, estudiante);
      expect(caso.obtenerEstudiante()).toBe(estudiante);
      expect(caso.origen.obtenerEstudiante()).toBe(estudiante);
    });
  });

  describe('canalizar (R03, sd_CUD04)', () => {
    it('ruta ACADEMICA deja el caso EN_NIVELACION', () => {
      const { caso } = casoDeAlerta();
      expect(caso.estaCanalizado()).toBe(false);
      caso.canalizar(RutaAtencion.ACADEMICA);
      expect(caso.ruta).toBe(RutaAtencion.ACADEMICA);
      expect(caso.estado).toBe(EstadoCaso.EN_NIVELACION);
      expect(caso.estaCanalizado()).toBe(true);
    });

    it('ruta PSICOLOGICA mantiene el caso PENDIENTE', () => {
      const { caso } = casoDeAlerta();
      caso.canalizar(RutaAtencion.PSICOLOGICA);
      expect(caso.estado).toBe(EstadoCaso.PENDIENTE);
    });

    it('rechaza canalizar un caso ya canalizado (5.a)', () => {
      const { caso } = casoDeAlerta();
      caso.canalizar(RutaAtencion.ACADEMICA);
      expect(() => caso.canalizar(RutaAtencion.PSICOLOGICA)).toThrow(
        /ya fue canalizado/,
      );
    });

    it('la solicitud psicosocial nace canalizada y no se puede volver a canalizar', () => {
      const caso = casoDeSolicitud(RutaAtencion.PSICOLOGICA);
      expect(caso.estaCanalizado()).toBe(true);
      expect(() => caso.canalizar(RutaAtencion.ACADEMICA)).toThrow();
    });
  });

  describe('asignarPsicologo y aprobar (R05, sd_CUD06)', () => {
    it('asigna el psicólogo y pasa a EN_EVALUACION', () => {
      const caso = casoDeSolicitud(RutaAtencion.PSICOLOGICA);
      const psicologo = crearPsicologo();
      expect(caso.asignarPsicologo(psicologo)).toBe(true);
      expect(caso.psicologo).toBe(psicologo);
      expect(caso.estado).toBe(EstadoCaso.EN_EVALUACION);
    });

    it('devuelve false si el caso ya tiene otro psicólogo', () => {
      const caso = casoEnEvaluacion();
      expect(caso.asignarPsicologo(crearPsicologo('PS2'))).toBe(false);
      expect(caso.psicologo?.id).toBe('PS1');
    });

    it('acepta reasignar al mismo psicólogo', () => {
      const caso = casoEnEvaluacion();
      expect(caso.asignarPsicologo(crearPsicologo('PS1'))).toBe(true);
    });

    it('asignarPsicologo exige ruta PSICOLOGICA', () => {
      const { caso } = casoDeAlerta();
      expect(() => caso.asignarPsicologo(crearPsicologo())).toThrow(
        /PSICOLOGICA/,
      );
    });

    it('aprobar mantiene EN_EVALUACION (EstadoCaso no tiene valor de aprobado)', () => {
      const caso = casoEnEvaluacion();
      caso.aprobar();
      expect(caso.estado).toBe(EstadoCaso.EN_EVALUACION);
    });

    it('aprobar exige ruta PSICOLOGICA', () => {
      const { caso } = casoDeAlerta();
      caso.canalizar(RutaAtencion.ACADEMICA);
      expect(() => caso.aprobar()).toThrow(/PSICOLOGICA/);
    });

    it('aprobar exige un psicólogo asignado', () => {
      const caso = casoDeSolicitud(RutaAtencion.PSICOLOGICA);
      expect(() => caso.aprobar()).toThrow(/en evaluación/);
    });
  });

  describe('archivar y reorientar (CUD07 2.a y 2.b)', () => {
    it('archivar guarda la justificación y deja ARCHIVADO', () => {
      const caso = casoEnEvaluacion();
      caso.archivar('No pertinente');
      expect(caso.estado).toBe(EstadoCaso.ARCHIVADO);
      expect(caso.justificacion).toBe('No pertinente');
    });

    it('reorientar guarda la justificación y deja REORIENTADO', () => {
      const caso = casoEnEvaluacion();
      caso.reorientar('Corresponde a otra área');
      expect(caso.estado).toBe(EstadoCaso.REORIENTADO);
      expect(caso.justificacion).toBe('Corresponde a otra área');
    });
  });

  describe('consentimiento del menor (R05/R06)', () => {
    const menor = () => crearEstudiante(new Date(2010, 5, 1));
    const mayor = () => crearEstudiante(new Date(2000, 5, 1));

    it('un menor sin consentimiento requiere consentimiento y no está habilitado', () => {
      const caso = casoEnEvaluacion(menor());
      expect(caso.requiereConsentimiento(HOY)).toBe(true);
      expect(caso.habilitadoParaAtencion(HOY)).toBe(false);
    });

    it('al confirmar el consentimiento el menor queda habilitado', () => {
      const caso = casoEnEvaluacion(menor());
      caso.confirmarConsentimiento();
      expect(caso.consentimientoConfirmado).toBe(true);
      expect(caso.requiereConsentimiento(HOY)).toBe(false);
      expect(caso.habilitadoParaAtencion(HOY)).toBe(true);
    });

    it('un mayor de edad no requiere consentimiento y está habilitado', () => {
      const caso = casoEnEvaluacion(mayor());
      expect(caso.requiereConsentimiento(HOY)).toBe(false);
      expect(caso.habilitadoParaAtencion(HOY)).toBe(true);
    });

    it('programarCita NO exige consentimiento (ER R05)', () => {
      const caso = casoEnEvaluacion(menor());
      expect(caso.habilitadoParaAtencion(HOY)).toBe(false);
      expect(() =>
        caso.programarCita(new Date(2026, 10, 20, 9), Modalidad.VIRTUAL),
      ).not.toThrow();
    });
  });

  describe('programarCita (sd_CUD06)', () => {
    it('la primera cita nace PROGRAMADA y deja el caso CITADO', () => {
      const caso = casoEnEvaluacion();
      const cita = caso.programarCita(
        new Date(2026, 10, 20, 9),
        Modalidad.PRESENCIAL,
      );
      expect(cita.estado).toBe(EstadoCita.PROGRAMADA);
      expect(caso.estado).toBe(EstadoCaso.CITADO);
      expect(caso.citas).toHaveLength(1);
    });

    it('las siguientes citas dejan el caso EN_SEGUIMIENTO', () => {
      const caso = casoEnEvaluacion();
      caso.programarCita(new Date(2026, 10, 20, 9), Modalidad.PRESENCIAL);
      caso.programarCita(new Date(2026, 10, 27, 9), Modalidad.VIRTUAL);
      expect(caso.estado).toBe(EstadoCaso.EN_SEGUIMIENTO);
    });

    it('exige un psicólogo asignado', () => {
      const caso = casoDeSolicitud(RutaAtencion.PSICOLOGICA);
      expect(() => caso.programarCita(HOY, Modalidad.VIRTUAL)).toThrow(
        /psicólogo/,
      );
    });

    it('la lista de citas expuesta no modifica el caso', () => {
      const caso = casoEnEvaluacion();
      caso.programarCita(HOY, Modalidad.VIRTUAL);
      (caso.citas as unknown as unknown[]).length = 0;
      expect(caso.citas).toHaveLength(1);
    });
  });

  describe('cerrar (R06, sd_CUD06 6.b)', () => {
    it('devuelve false si no hay citas', () => {
      const caso = casoEnEvaluacion();
      expect(caso.cerrar()).toBe(false);
      expect(caso.estado).toBe(EstadoCaso.EN_EVALUACION);
    });

    it('devuelve false si la última cita no tiene asesoría', () => {
      const caso = casoEnEvaluacion();
      caso.programarCita(HOY, Modalidad.VIRTUAL);
      expect(caso.cerrar()).toBe(false);
    });

    it('devuelve false si la asesoría de la última cita está incompleta', () => {
      const caso = casoEnEvaluacion();
      const cita = caso.programarCita(HOY, Modalidad.VIRTUAL);
      cita.generarAsesoria(
        TipoAsesoria.ORIENTACION,
        '',
        '',
        true,
        false,
        false,
      );
      expect(caso.cerrar()).toBe(false);
    });

    it('cierra el caso si la asesoría de la última cita está completa', () => {
      const caso = casoEnEvaluacion();
      const cita = caso.programarCita(HOY, Modalidad.VIRTUAL);
      cita.generarAsesoria(
        TipoAsesoria.ORIENTACION,
        'Observaciones',
        '',
        true,
        false,
        false,
      );
      expect(caso.cerrar()).toBe(true);
      expect(caso.estado).toBe(EstadoCaso.CERRADO);
    });

    it('usa la cita más reciente por fecha y hora', () => {
      const caso = casoEnEvaluacion();
      const posterior = caso.programarCita(
        new Date(2026, 10, 27, 9),
        Modalidad.VIRTUAL,
      );
      const anterior = caso.programarCita(
        new Date(2026, 10, 20, 9),
        Modalidad.VIRTUAL,
      );
      anterior.generarAsesoria(
        TipoAsesoria.ORIENTACION,
        'Completa',
        '',
        true,
        false,
        false,
      );
      expect(caso.cerrar()).toBe(false);
      posterior.generarAsesoria(
        TipoAsesoria.SEGUIMIENTO,
        'Completa',
        '',
        true,
        false,
        false,
      );
      expect(caso.cerrar()).toBe(true);
    });
  });

  describe('estaFinalizado (ER R07, sd_CUD10)', () => {
    it('es verdadero para ARCHIVADO', () => {
      const caso = casoEnEvaluacion();
      caso.archivar('No pertinente');
      expect(caso.estaFinalizado()).toBe(true);
    });

    it('es verdadero para CERRADO', () => {
      const caso = casoEnEvaluacion();
      const cita = caso.programarCita(HOY, Modalidad.VIRTUAL);
      cita.generarAsesoria(
        TipoAsesoria.ORIENTACION,
        'Completa',
        '',
        true,
        false,
        false,
      );
      caso.cerrar();
      expect(caso.estaFinalizado()).toBe(true);
    });

    it('es falso para REORIENTADO (decisión abierta D11)', () => {
      const caso = casoEnEvaluacion();
      caso.reorientar('Otra área');
      expect(caso.estaFinalizado()).toBe(false);
    });

    it('un caso finalizado no admite más cambios', () => {
      const caso = casoEnEvaluacion();
      caso.archivar('No pertinente');
      expect(() => caso.programarCita(HOY, Modalidad.VIRTUAL)).toThrow(
        /finalizado/,
      );
      expect(() => caso.reorientar('x')).toThrow(/finalizado/);
    });
  });

  it('expone una asesoría generada a través de su cita', () => {
    const caso = casoEnEvaluacion();
    const cita = caso.programarCita(HOY, Modalidad.VIRTUAL);
    const asesoria = cita.generarAsesoria(
      TipoAsesoria.ORIENTACION,
      'Obs',
      '',
      false,
      false,
      false,
    );
    expect(caso.citas[0]?.asesoria).toBeInstanceOf(Asesoria);
    expect(caso.citas[0]?.asesoria).toBe(asesoria);
  });
});
