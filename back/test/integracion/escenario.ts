import type { DataSource } from 'typeorm';
import type { Alerta } from '../../src/dominio/entidades/alerta';
import type { CasoRiesgo } from '../../src/dominio/entidades/caso-riesgo';
import { Curso } from '../../src/dominio/entidades/curso';
import { Docente } from '../../src/dominio/entidades/docente';
import { Estudiante } from '../../src/dominio/entidades/estudiante';
import { JefeDepartamento } from '../../src/dominio/entidades/jefe-departamento';
import { NivelRiesgo } from '../../src/dominio/entidades/nivel-riesgo';
import { Programa } from '../../src/dominio/entidades/programa';
import { Psicologo } from '../../src/dominio/entidades/psicologo';
import { RegistroAcademico } from '../../src/dominio/entidades/registro-academico';
import type { SolicitudAcompanamiento } from '../../src/dominio/entidades/solicitud-acompanamiento';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
import {
  crearRepositorioAsesoria,
  crearRepositorioCita,
  crearRepositorioCurso,
  crearRepositorioInformeRiesgo,
  crearRepositorioPrograma,
} from '../../src/persistencia/repositorios-genericos';
import {
  RepositorioPersistenteAlerta,
  RepositorioPersistenteCasoRiesgo,
  RepositorioPersistentePersona,
  RepositorioPersistentePlanNivelacion,
  RepositorioPersistenteRegistroAcademico,
  RepositorioPersistenteSolicitud,
} from '../../src/persistencia/repositorios-persistentes';

/** Todos los repositorios sobre una conexión. */
export function crearRepositorios(fuente: DataSource) {
  return {
    personas: new RepositorioPersistentePersona(fuente),
    casos: new RepositorioPersistenteCasoRiesgo(fuente),
    alertas: new RepositorioPersistenteAlerta(fuente),
    solicitudes: new RepositorioPersistenteSolicitud(fuente),
    registros: new RepositorioPersistenteRegistroAcademico(fuente),
    planes: new RepositorioPersistentePlanNivelacion(fuente),
    programas: crearRepositorioPrograma(fuente),
    cursos: crearRepositorioCurso(fuente),
    citas: crearRepositorioCita(fuente),
    asesorias: crearRepositorioAsesoria(fuente),
    informes: crearRepositorioInformeRiesgo(fuente),
  };
}

export type Repositorios = ReturnType<typeof crearRepositorios>;

export const PERIODO = '2026-2';
export const OTRO_PERIODO = '2026-1';

export function estudiante(
  id: string,
  programa: Programa,
  fechaNacimiento = new Date(2000, 4, 15),
): Estudiante {
  return new Estudiante({
    id,
    nombre: `Estudiante ${id}`,
    correo: `${id.toLowerCase()}@ejemplo.edu.co`,
    contrasenaHash: `$2b$10$hash-de-prueba-${id}`,
    fechaNacimiento,
    programa,
  });
}

/**
 * Escenario base persistido:
 * - Programa P1 con su jefe J1; programa P2 SIN jefe configurado.
 * - Docente D1 que dicta C1 (periodo 2026-2) y C0 (2026-1).
 * - Estudiantes E1 y E2 de P1 y E3 de P2, con registros en C1 y C0.
 * - Psicólogo PS1.
 */
export async function crearEscenario(repos: Repositorios) {
  const p1 = new Programa({
    idPrograma: 'P1',
    nombre: 'Ingeniería de Sistemas',
  });
  const p2 = new Programa({ idPrograma: 'P2', nombre: 'Química' });
  const e1 = estudiante('E1', p1);
  const e2 = estudiante('E2', p1, new Date(2010, 0, 10));
  const e3 = estudiante('E3', p2);
  const c1 = new Curso({
    idCurso: 'C1',
    nombre: 'Cálculo',
    periodo: PERIODO,
    ultimaSincronizacion: null,
    estudiantes: [e1, e2, e3],
  });
  const c0 = new Curso({
    idCurso: 'C0',
    nombre: 'Álgebra',
    periodo: OTRO_PERIODO,
    ultimaSincronizacion: null,
    estudiantes: [e1],
  });
  const d1 = new Docente({
    id: 'D1',
    nombre: 'Docente Uno',
    correo: 'd1@ejemplo.edu.co',
    contrasenaHash: '$2b$10$hash-docente',
    cursos: [c1, c0],
  });
  const j1 = new JefeDepartamento({
    id: 'J1',
    nombre: 'Jefe Uno',
    correo: 'j1@ejemplo.edu.co',
    contrasenaHash: '$2b$10$hash-jefe',
    programa: p1,
  });
  const ps1 = new Psicologo({
    id: 'PS1',
    nombre: 'Psicóloga Uno',
    correo: 'ps1@ejemplo.edu.co',
    contrasenaHash: '$2b$10$hash-psico',
    citas: [],
  });
  const r1 = new RegistroAcademico({
    idRegistro: 'R1',
    nota: 2.4,
    porcentajeAsistencia: 61.5,
    estudiante: e1,
    curso: c1,
  });
  const r2 = new RegistroAcademico({
    idRegistro: 'R2',
    nota: 3.1,
    porcentajeAsistencia: 88,
    estudiante: e2,
    curso: c1,
  });
  const r3 = new RegistroAcademico({
    idRegistro: 'R3',
    nota: 1.9,
    porcentajeAsistencia: 40,
    estudiante: e3,
    curso: c1,
  });
  const r0 = new RegistroAcademico({
    idRegistro: 'R0',
    nota: 2,
    porcentajeAsistencia: 50,
    estudiante: e1,
    curso: c0,
  });

  await repos.programas.guardar(p1);
  await repos.programas.guardar(p2);
  for (const persona of [e1, e2, e3, j1, ps1, d1]) {
    await repos.personas.guardar(persona);
  }
  for (const registro of [r1, r2, r3, r0]) {
    await repos.registros.guardar(registro);
  }
  return { p1, p2, e1, e2, e3, c1, c0, d1, j1, ps1, r1, r2, r3, r0 };
}

export type Escenario = Awaited<ReturnType<typeof crearEscenario>>;

/** Emite y guarda una alerta y su caso. */
export async function casoDeAlerta(
  repos: Repositorios,
  docente: Docente,
  registro: RegistroAcademico,
  descripcion = 'Bajo rendimiento',
): Promise<{ alerta: Alerta; caso: CasoRiesgo }> {
  const alerta = docente.emitirAlerta(registro, NivelRiesgo.ALTO, descripcion);
  const caso = alerta.generarCasoRiesgo();
  await repos.alertas.guardar(alerta);
  await repos.casos.guardar(caso);
  return { alerta, caso };
}

/** Radica y guarda una solicitud y su caso. */
export async function casoDeSolicitud(
  repos: Repositorios,
  alumno: Estudiante,
  tipoApoyo: RutaAtencion,
): Promise<{ solicitud: SolicitudAcompanamiento; caso: CasoRiesgo }> {
  const solicitud = alumno.solicitarAcompanamiento(
    tipoApoyo,
    'Necesito apoyo',
    'Lunes en la tarde',
  );
  const caso = solicitud.generarCasoRiesgo();
  await repos.solicitudes.guardar(solicitud);
  await repos.casos.guardar(caso);
  return { solicitud, caso };
}
