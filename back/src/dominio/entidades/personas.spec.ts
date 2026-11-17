import { Cita } from './cita';
import { Curso } from './curso';
import { EstadoCita } from './estado-cita';
import { Estudiante } from './estudiante';
import { JefeDepartamento } from './jefe-departamento';
import { Modalidad } from './modalidad';
import { Programa } from './programa';
import { Psicologo } from './psicologo';
import { Rol } from './rol';

const programa = new Programa({
  idPrograma: 'P1',
  nombre: 'Ingeniería de Sistemas',
});

function estudianteNacidoEl(fechaNacimiento: Date): Estudiante {
  return new Estudiante({
    id: 'E1',
    nombre: 'Ana',
    correo: 'ana@ejemplo.edu.co',
    contrasenaHash: 'hash',
    fechaNacimiento,
    programa,
  });
}

function cita(fechaHora: Date, estado: EstadoCita): Cita {
  return new Cita({
    idCita: `C-${fechaHora.getTime()}-${estado}`,
    fechaHora,
    modalidad: Modalidad.PRESENCIAL,
    estado,
    asesoria: null,
  });
}

describe('Persona', () => {
  it('cada subclase devuelve su rol y el enumerado Rol tiene exactamente cuatro valores', () => {
    const jefe = new JefeDepartamento({
      id: 'J1',
      nombre: 'Jefe',
      correo: 'jefe@ejemplo.edu.co',
      contrasenaHash: 'hash',
      programa,
    });
    const psicologo = new Psicologo({
      id: 'PS1',
      nombre: 'Psicólogo',
      correo: 'ps@ejemplo.edu.co',
      contrasenaHash: 'hash',
      citas: [],
    });
    expect(estudianteNacidoEl(new Date(2000, 0, 1)).obtenerRol()).toBe(
      Rol.ESTUDIANTE,
    );
    expect(jefe.obtenerRol()).toBe(Rol.JEFE_DEPARTAMENTO);
    expect(jefe.programa).toBe(programa);
    expect(psicologo.obtenerRol()).toBe(Rol.PSICOLOGO);
    expect(Object.values(Rol)).toEqual([
      'ESTUDIANTE',
      'DOCENTE',
      'JEFE_DEPARTAMENTO',
      'PSICOLOGO',
    ]);
  });

  it('no expone contrasenaHash ni lo filtra al serializar', () => {
    const estudiante = estudianteNacidoEl(new Date(2000, 0, 1));
    expect(Object.keys(estudiante)).not.toContain('contrasenaHash');
    expect(JSON.stringify(estudiante)).not.toContain('hash');
    expect(
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(estudiante),
        'contrasenaHash',
      ),
    ).toBeUndefined();
  });
});

describe('Estudiante', () => {
  const hoy = new Date(2026, 10, 16);

  it('es menor de edad la víspera de cumplir 18', () => {
    expect(estudianteNacidoEl(new Date(2008, 10, 17)).esMenorDeEdad(hoy)).toBe(
      true,
    );
  });

  it('es mayor de edad el día en que cumple 18', () => {
    expect(estudianteNacidoEl(new Date(2008, 10, 16)).esMenorDeEdad(hoy)).toBe(
      false,
    );
  });

  it('obtenerPrograma devuelve el programa que cursa', () => {
    expect(estudianteNacidoEl(new Date(2000, 0, 1)).obtenerPrograma()).toBe(
      programa,
    );
  });
});

describe('Psicologo.estaDisponible (sd_CUD06, D9)', () => {
  const nueveAm = new Date(2026, 10, 20, 9, 0);

  it('no está disponible si tiene una cita PROGRAMADA a esa fecha y hora', () => {
    const psicologo = new Psicologo({
      id: 'PS1',
      nombre: 'Ps',
      correo: 'ps@ejemplo.edu.co',
      contrasenaHash: 'h',
      citas: [cita(nueveAm, EstadoCita.PROGRAMADA)],
    });
    expect(psicologo.estaDisponible(new Date(nueveAm))).toBe(false);
  });

  it('no está disponible si tiene una cita REPROGRAMADA a esa fecha y hora', () => {
    const psicologo = new Psicologo({
      id: 'PS1',
      nombre: 'Ps',
      correo: 'ps@ejemplo.edu.co',
      contrasenaHash: 'h',
      citas: [cita(nueveAm, EstadoCita.REPROGRAMADA)],
    });
    expect(psicologo.estaDisponible(nueveAm)).toBe(false);
  });

  it('está disponible si la cita a esa hora está CERRADA o si es otra hora (sin duración: D9)', () => {
    const psicologo = new Psicologo({
      id: 'PS1',
      nombre: 'Ps',
      correo: 'ps@ejemplo.edu.co',
      contrasenaHash: 'h',
      citas: [cita(nueveAm, EstadoCita.CERRADA)],
    });
    expect(psicologo.estaDisponible(nueveAm)).toBe(true);
    expect(psicologo.estaDisponible(new Date(2026, 10, 20, 9, 30))).toBe(true);
  });
});

describe('Curso', () => {
  it('obtenerEstudiantes devuelve los estudiantes sin repetidos', () => {
    const ana = estudianteNacidoEl(new Date(2000, 0, 1));
    const curso = new Curso({
      idCurso: 'C1',
      nombre: 'Cálculo',
      periodo: '2026-2',
      ultimaSincronizacion: null,
      estudiantes: [ana, ana],
    });
    expect(curso.obtenerEstudiantes()).toEqual([ana]);
  });

  it('marcarSincronizado registra la fecha de la última sincronización', () => {
    const curso = new Curso({
      idCurso: 'C1',
      nombre: 'Cálculo',
      periodo: '2026-2',
      ultimaSincronizacion: null,
      estudiantes: [],
    });
    const ahora = new Date(2026, 10, 16, 2, 0);
    curso.marcarSincronizado(ahora);
    expect(curso.ultimaSincronizacion?.getTime()).toBe(ahora.getTime());
  });
});
