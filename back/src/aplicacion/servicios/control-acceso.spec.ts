import { CasoRiesgo } from '../../dominio/entidades/caso-riesgo';
import { Docente } from '../../dominio/entidades/docente';
import { Estudiante } from '../../dominio/entidades/estudiante';
import { JefeDepartamento } from '../../dominio/entidades/jefe-departamento';
import type { Persona } from '../../dominio/entidades/persona';
import { Programa } from '../../dominio/entidades/programa';
import { Psicologo } from '../../dominio/entidades/psicologo';
import { Rol } from '../../dominio/entidades/rol';
import { RutaAtencion } from '../../dominio/entidades/ruta-atencion';
import { ControlAcceso, MATRIZ_PERMISOS } from './control-acceso';

const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
const base = (id: string) => ({
  id,
  nombre: id,
  correo: `${id}@x.co`,
  contrasenaHash: 'h',
});
const estudiante = new Estudiante({
  ...base('E1'),
  fechaNacimiento: new Date(2000, 0, 1),
  programa,
});
const docente = new Docente({ ...base('D1'), cursos: [] });
const jefe = new JefeDepartamento({ ...base('J1'), programa });
const psicologo = new Psicologo({ ...base('PS1'), citas: [] });
const otroPsicologo = new Psicologo({ ...base('PS2'), citas: [] });

const USUARIOS: Record<Rol, Persona> = {
  [Rol.ESTUDIANTE]: estudiante,
  [Rol.DOCENTE]: docente,
  [Rol.JEFE_DEPARTAMENTO]: jefe,
  [Rol.PSICOLOGO]: psicologo,
};

const control = new ControlAcceso();

describe('ControlAcceso.puedeEjecutar (matriz aprobada en el plan de B3)', () => {
  const todasLasAcciones = [...new Set(Object.values(MATRIZ_PERMISOS).flat())];

  for (const rol of Object.values(Rol)) {
    it(`${rol}: permite exactamente sus acciones y deniega las demás`, () => {
      for (const accion of todasLasAcciones) {
        expect([accion, control.puedeEjecutar(USUARIOS[rol], accion)]).toEqual([
          accion,
          MATRIZ_PERMISOS[rol].includes(accion),
        ]);
      }
    });
  }

  it('deniega una acción desconocida y ejecutarSincronizacion para todos los roles', () => {
    for (const usuario of Object.values(USUARIOS)) {
      expect(control.puedeEjecutar(usuario, 'accionInexistente')).toBe(false);
      expect(control.puedeEjecutar(usuario, 'ejecutarSincronizacion')).toBe(
        false,
      );
    }
  });

  it('usa la cadena de sd_CUD04 listarCasosPendiente (no listarCasosPendientes)', () => {
    expect(control.puedeEjecutar(jefe, 'listarCasosPendiente')).toBe(true);
    expect(control.puedeEjecutar(jefe, 'listarCasosPendientes')).toBe(false);
  });

  it('generarInforme y exportarInforme: Jefe y Psicólogo (sd_CUD10)', () => {
    expect(control.puedeEjecutar(jefe, 'generarInforme')).toBe(true);
    expect(control.puedeEjecutar(psicologo, 'exportarInforme')).toBe(true);
    expect(control.puedeEjecutar(docente, 'generarInforme')).toBe(false);
    expect(control.puedeEjecutar(estudiante, 'generarInforme')).toBe(false);
  });
});

describe('ControlAcceso.puedeVerContenidoConfidencial (ER 3.7 c, 3.5.3; Manual CU_12)', () => {
  function casoPsicologico(asignado: Psicologo | null): CasoRiesgo {
    const caso = estudiante
      .solicitarAcompanamiento(
        RutaAtencion.PSICOLOGICA,
        'Motivo reservado',
        'Lunes',
      )
      .generarCasoRiesgo();
    if (asignado) {
      caso.asignarPsicologo(asignado);
    }
    return caso;
  }

  it('el psicólogo asignado lo ve', () => {
    expect(
      control.puedeVerContenidoConfidencial(
        psicologo,
        casoPsicologico(psicologo),
      ),
    ).toBe(true);
  });

  it('cualquier psicólogo lo ve si el caso aún no tiene psicólogo (para evaluar la pertinencia)', () => {
    expect(
      control.puedeVerContenidoConfidencial(
        otroPsicologo,
        casoPsicologico(null),
      ),
    ).toBe(true);
  });

  it('un psicólogo distinto del asignado NO lo ve', () => {
    expect(
      control.puedeVerContenidoConfidencial(
        otroPsicologo,
        casoPsicologico(psicologo),
      ),
    ).toBe(false);
  });

  it('el Estudiante, el Docente y el Jefe NO lo ven', () => {
    const caso = casoPsicologico(psicologo);
    for (const usuario of [estudiante, docente, jefe]) {
      expect(control.puedeVerContenidoConfidencial(usuario, caso)).toBe(false);
    }
  });

  it('ni el psicólogo lo ve si el caso no tiene ruta PSICOLOGICA', () => {
    const casoAcademico = estudiante
      .solicitarAcompanamiento(RutaAtencion.ACADEMICA, 'Motivo', 'Lunes')
      .generarCasoRiesgo();
    casoAcademico.canalizar(RutaAtencion.ACADEMICA);
    expect(
      control.puedeVerContenidoConfidencial(psicologo, casoAcademico),
    ).toBe(false);
  });
});

describe('D18: matriz de puedeVerContenidoConfidencial (plan de B7, respuesta 1 y ajuste A)', () => {
  const otroPrograma = new Programa({ idPrograma: 'P2', nombre: 'Química' });
  const jefeOtro = new JefeDepartamento({
    ...base('J2'),
    programa: otroPrograma,
  });

  function solicitud(tipo: RutaAtencion): CasoRiesgo {
    return estudiante
      .solicitarAcompanamiento(tipo, 'Motivo reservado', 'Lunes')
      .generarCasoRiesgo();
  }

  /** [descripción del caso, fábrica] */
  const CASOS: [string, () => CasoRiesgo][] = [
    [
      'solicitud académica sin canalizar',
      () => solicitud(RutaAtencion.ACADEMICA),
    ],
    [
      'solicitud académica canalizada a la ruta académica',
      () => {
        const caso = solicitud(RutaAtencion.ACADEMICA);
        caso.canalizar(RutaAtencion.ACADEMICA);
        return caso;
      },
    ],
    [
      'solicitud académica canalizada a psicología, sin psicólogo',
      () => {
        const caso = solicitud(RutaAtencion.ACADEMICA);
        caso.canalizar(RutaAtencion.PSICOLOGICA);
        return caso;
      },
    ],
    [
      'solicitud académica canalizada a psicología, asignada a PS1',
      () => {
        const caso = solicitud(RutaAtencion.ACADEMICA);
        caso.canalizar(RutaAtencion.PSICOLOGICA);
        caso.asignarPsicologo(psicologo);
        return caso;
      },
    ],
    [
      'solicitud psicosocial sin psicólogo',
      () => solicitud(RutaAtencion.PSICOLOGICA),
    ],
    [
      'solicitud psicosocial asignada a PS1',
      () => {
        const caso = solicitud(RutaAtencion.PSICOLOGICA);
        caso.asignarPsicologo(psicologo);
        return caso;
      },
    ],
  ];

  /** Resultado esperado por caso: [Jefe del programa, Jefe de otro programa, PS1, PS2, Docente, Estudiante]. */
  const ESPERADO: Record<string, boolean[]> = {
    'solicitud académica sin canalizar': [
      true,
      false,
      false,
      false,
      false,
      false,
    ],
    'solicitud académica canalizada a la ruta académica': [
      true,
      false,
      false,
      false,
      false,
      false,
    ],
    'solicitud académica canalizada a psicología, sin psicólogo': [
      false,
      false,
      true,
      true,
      false,
      false,
    ],
    'solicitud académica canalizada a psicología, asignada a PS1': [
      false,
      false,
      true,
      false,
      false,
      false,
    ],
    'solicitud psicosocial sin psicólogo': [
      false,
      false,
      true,
      true,
      false,
      false,
    ],
    'solicitud psicosocial asignada a PS1': [
      false,
      false,
      true,
      false,
      false,
      false,
    ],
  };

  const ROLES: [string, Persona][] = [
    ['Jefe del programa', jefe],
    ['Jefe de otro programa', jefeOtro],
    ['PS1', psicologo],
    ['PS2', otroPsicologo],
    ['Docente', docente],
    ['Estudiante', estudiante],
  ];

  it.each(CASOS)('%s', (nombre, crear) => {
    const caso = crear();
    const obtenido = ROLES.map(([, usuario]) =>
      control.puedeVerContenidoConfidencial(usuario, caso),
    );
    expect(
      Object.fromEntries(ROLES.map(([rol], i) => [rol, obtenido[i]])),
    ).toEqual(
      Object.fromEntries(ROLES.map(([rol], i) => [rol, ESPERADO[nombre]?.[i]])),
    );
  });
});
