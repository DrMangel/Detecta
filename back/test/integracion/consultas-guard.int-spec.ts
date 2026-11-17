import type { DataSource } from 'typeorm';
import { Modalidad } from '../../src/dominio/entidades/modalidad';
import { RutaAtencion } from '../../src/dominio/entidades/ruta-atencion';
import {
  casoDeAlerta,
  casoDeSolicitud,
  crearEscenario,
  crearRepositorios,
} from './escenario';
import {
  abrirFuenteAplicacion,
  ContadorConsultas,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './soporte';

/**
 * Consultas SQL que hace GuardSesion por petición (ajuste F de Ivan): el guard
 * verifica el JWT (sin BD) y carga la persona con
 * `RepositorioPersona.buscarPorId`, que reconstruye su grafo completo.
 * Escenario: docente con 2 cursos y 3 estudiantes; psicólogo con 2 citas.
 */
const TOPE_REVISION = 10;

let fuente: DataSource;
let contador: ContadorConsultas;

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  contador = new ContadorConsultas();
  fuente = await abrirFuenteAplicacion(contador);
  const repos = crearRepositorios(fuente);
  const esc = await crearEscenario(repos);
  await casoDeAlerta(repos, esc.d1, esc.r1);
  for (const [i, alumno] of [esc.e1, esc.e2].entries()) {
    const { caso } = await casoDeSolicitud(
      repos,
      alumno,
      RutaAtencion.PSICOLOGICA,
    );
    caso.asignarPsicologo(esc.ps1);
    caso.programarCita(new Date(2026, 10, 20 + i, 9), Modalidad.VIRTUAL);
    await repos.casos.guardar(caso);
  }
});

afterAll(async () => {
  await fuente.destroy();
});

it(`consultas del guard por rol (revisión si alguno pasa de ${TOPE_REVISION})`, async () => {
  const repos = crearRepositorios(fuente);
  const resultado: Record<string, number> = {};
  for (const [rol, id] of [
    ['estudiante', 'E1'],
    ['docente', 'D1'],
    ['jefe', 'J1'],
    ['psicologo', 'PS1'],
  ] as const) {
    contador.total = 0;
    const persona = await repos.personas.buscarPorId(id);
    expect(persona?.id).toBe(id);
    resultado[rol] = contador.total;
  }
  console.log(`Consultas del guard por rol: ${JSON.stringify(resultado)}`);
  for (const total of Object.values(resultado)) {
    expect(total).toBeGreaterThan(0);
  }
});
