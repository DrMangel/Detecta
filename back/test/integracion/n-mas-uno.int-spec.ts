import type { DataSource } from 'typeorm';
import { Curso } from '../../src/dominio/entidades/curso';
import { Docente } from '../../src/dominio/entidades/docente';
import { RegistroAcademico } from '../../src/dominio/entidades/registro-academico';
import {
  casoDeAlerta,
  crearEscenario,
  crearRepositorios,
  estudiante,
  PERIODO,
  type Repositorios,
} from './escenario';
import {
  abrirFuenteAplicacion,
  ContadorConsultas,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';

/**
 * Sin N+1 (condición de Ivan en el plan de B2). El cargador consulta por
 * lotes: el número de consultas depende de la profundidad del grafo, no de
 * la cantidad de casos.
 *
 * TOPE DOCUMENTADO: listar casos de origen alerta (con estudiante, programa,
 * origen, docente, cursos del docente, estudiantes de esos cursos, registro,
 * citas y asesorías) no puede usar más de 15 consultas SQL, sea cual sea el
 * número de casos.
 */
const TOPE_CONSULTAS = 15;

let fuente: DataSource;
let contador: ContadorConsultas;
let repos: Repositorios;

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  contador = new ContadorConsultas();
  fuente = await abrirFuenteAplicacion(contador);
  repos = crearRepositorios(fuente);
});

afterAll(async () => {
  await fuente.destroy();
});

/** Crea `cantidad` casos de alerta de estudiantes nuevos de P1, con dos docentes. */
async function crearCasosDeAlerta(
  cantidad: number,
  prefijo: string,
): Promise<void> {
  const esc = await repos.programas.buscarPorId('P1');
  const programa = esc!;
  const alumnos = Array.from({ length: cantidad }, (_, i) =>
    estudiante(`${prefijo}${i}`, programa),
  );
  for (const alumno of alumnos) {
    await repos.personas.guardar(alumno);
  }
  const curso = new Curso({
    idCurso: `${prefijo}-CURSO`,
    nombre: `Curso ${prefijo}`,
    periodo: PERIODO,
    ultimaSincronizacion: null,
    estudiantes: alumnos,
  });
  const docentes = [0, 1].map(
    (n) =>
      new Docente({
        id: `${prefijo}-D${n}`,
        nombre: `Docente ${prefijo}${n}`,
        correo: `${prefijo.toLowerCase()}-d${n}@ejemplo.edu.co`,
        contrasenaHash: 'h',
        cursos: n === 0 ? [curso] : [],
      }),
  );
  for (const docente of docentes) {
    await repos.personas.guardar(docente);
  }
  for (const [i, alumno] of alumnos.entries()) {
    const registro = new RegistroAcademico({
      idRegistro: `${prefijo}-R${i}`,
      nota: 2,
      porcentajeAsistencia: 55,
      estudiante: alumno,
      curso,
    });
    await repos.registros.guardar(registro);
    await casoDeAlerta(repos, docentes[0]!, registro, `Alerta ${i}`);
  }
}

async function consultasAlListar(): Promise<{
  consultas: number;
  casos: number;
}> {
  contador.total = 0;
  const casos = await repos.casos.listarPendientesPorPrograma('P1');
  return { consultas: contador.total, casos: casos.length };
}

it(`listar 20 casos de origen alerta usa como máximo ${TOPE_CONSULTAS} consultas y no crece con 40`, async () => {
  await crearEscenario(repos);
  await crearCasosDeAlerta(20, 'A');

  const con20 = await consultasAlListar();
  expect(con20.casos).toBe(20);
  expect(con20.consultas).toBeLessThanOrEqual(TOPE_CONSULTAS);

  await crearCasosDeAlerta(20, 'B');
  const con40 = await consultasAlListar();
  expect(con40.casos).toBe(40);
  expect(con40.consultas).toBe(con20.consultas);

  console.log(
    `Consultas SQL al listar: 20 casos → ${con20.consultas}; 40 casos → ${con40.consultas} (tope ${TOPE_CONSULTAS})`,
  );
});
