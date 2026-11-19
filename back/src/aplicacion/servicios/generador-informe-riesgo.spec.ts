import type { CasoRiesgo } from '../../dominio/entidades/caso-riesgo';
import { Curso } from '../../dominio/entidades/curso';
import { Docente } from '../../dominio/entidades/docente';
import { Estudiante } from '../../dominio/entidades/estudiante';
import { InformeRiesgo } from '../../dominio/entidades/informe-riesgo';
import { JefeDepartamento } from '../../dominio/entidades/jefe-departamento';
import { NivelRiesgo } from '../../dominio/entidades/nivel-riesgo';
import { Programa } from '../../dominio/entidades/programa';
import { RegistroAcademico } from '../../dominio/entidades/registro-academico';
import { RutaAtencion } from '../../dominio/entidades/ruta-atencion';
import {
  DEFINICIONES_TOTALES,
  GeneradorInformeRiesgo,
  NOMBRE_ARCHIVO_INFORME,
} from './generador-informe-riesgo';

const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
const base = (id: string) => ({
  id,
  nombre: `Nombre ${id}`,
  correo: `${id.toLowerCase()}@ejemplo.edu.co`,
  contrasenaHash: 'h',
});
const ana = new Estudiante({
  ...base('E1'),
  fechaNacimiento: new Date(2000, 0, 1),
  programa,
});
const calculo = new Curso({
  idCurso: 'C1',
  nombre: 'Cálculo',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [ana],
});
const fisica = new Curso({
  idCurso: 'C2',
  nombre: 'Física',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [ana],
});
const docente = new Docente({ ...base('D1'), cursos: [calculo, fisica] });
const jefe = new JefeDepartamento({ ...base('J1'), programa });
const AHORA = new Date('2026-11-18T15:00:00Z');

function casoDeAlertaEn(curso: Curso): CasoRiesgo {
  const registro = new RegistroAcademico({
    idRegistro: `R-${curso.idCurso}`,
    nota: 2,
    porcentajeAsistencia: 50,
    estudiante: ana,
    curso,
  });
  return docente
    .emitirAlerta(registro, NivelRiesgo.ALTO, 'Motivo reservado del docente')
    .generarCasoRiesgo();
}

function preparar(datos: {
  alertas?: unknown[];
  casos?: CasoRiesgo[];
  planes?: unknown[];
}) {
  const repos = {
    alertas: { listarPorCurso: jest.fn(async () => datos.alertas ?? []) },
    casos: { listarPorPeriodo: jest.fn(async () => datos.casos ?? []) },
    planes: { listarPorPeriodo: jest.fn(async () => datos.planes ?? []) },
    informes: { guardarConAutor: jest.fn(async () => undefined) },
  };
  const generador = new GeneradorInformeRiesgo(
    repos.alertas as never,
    repos.casos as never,
    repos.planes as never,
    repos.informes as never,
    () => new Date(AHORA),
  );
  return { generador, repos };
}

describe('GeneradorInformeRiesgo.generar (sd_CUD10)', () => {
  it('filtra en memoria por la asignatura y guarda con autor y programa (respuestas 4 y 5)', async () => {
    const enCalculo = casoDeAlertaEn(calculo);
    const enFisica = casoDeAlertaEn(fisica);
    const solicitud = ana
      .solicitarAcompanamiento(RutaAtencion.PSICOLOGICA, 'x', '')
      .generarCasoRiesgo();
    const planCalculo = jefe.estructurarPlanNivelacion(
      (() => {
        const c = ana
          .solicitarAcompanamiento(RutaAtencion.ACADEMICA, 'y', '')
          .generarCasoRiesgo();
        c.canalizar(RutaAtencion.ACADEMICA);
        return c;
      })(),
      [calculo],
      'T',
      'T',
      '',
    );
    const planFisica = jefe.estructurarPlanNivelacion(
      planCalculo.caso,
      [fisica],
      'T',
      'T',
      '',
    );
    const { generador, repos } = preparar({
      alertas: [enCalculo.origen],
      casos: [enCalculo, enFisica, solicitud],
      planes: [planCalculo, planFisica],
    });
    const informe = await generador.generar('2026-2', 'P1', calculo, jefe);
    expect(repos.alertas.listarPorCurso).toHaveBeenCalledWith(
      'C1',
      '2026-2',
      'P1',
    );
    expect(repos.casos.listarPorPeriodo).toHaveBeenCalledWith('2026-2', 'P1');
    expect(repos.planes.listarPorPeriodo).toHaveBeenCalledWith('2026-2', 'P1');
    expect(informe).toBeInstanceOf(InformeRiesgo);
    expect(informe).toMatchObject({
      totalAlertas: 1,
      totalCasos: 1,
      totalPlanes: 1,
      periodo: '2026-2',
    });
    expect(informe?.casos.map((c) => c.idCaso)).toEqual([enCalculo.idCaso]);
    expect(informe?.fecha).toEqual(AHORA);
    expect(repos.informes.guardarConAutor).toHaveBeenCalledWith(
      informe,
      'P1',
      jefe,
    );
  });

  it('sin datos (los tres totales en cero): devuelve null y no guarda (respuesta 8)', async () => {
    const { generador, repos } = preparar({ casos: [casoDeAlertaEn(fisica)] });
    await expect(
      generador.generar('2026-2', 'P1', calculo, jefe),
    ).resolves.toBeNull();
    expect(repos.informes.guardarConAutor).not.toHaveBeenCalled();
  });
});

describe('GeneradorInformeRiesgo.exportar (ajustes A y G)', () => {
  it('PDF con nombre fijo, totales, definiciones y sin datos personales', () => {
    const caso = casoDeAlertaEn(calculo);
    const informe = new InformeRiesgo({
      idInforme: 'I1',
      fecha: AHORA,
      periodo: '2026-2',
      totalAlertas: 0,
      totalCasos: 0,
      totalPlanes: 0,
      resumen: '',
      curso: calculo,
      casos: [caso],
      planes: [],
      alertas: [caso.origen as never],
    });
    informe.consolidar();
    const archivo = preparar({}).generador.exportar(informe);
    expect(archivo.nombre).toBe(NOMBRE_ARCHIVO_INFORME);
    expect(archivo.tipoContenido).toBe('application/pdf');
    const texto = archivo.contenido.toString('latin1');
    expect(texto.startsWith('%PDF-')).toBe(true);
    expect(texto).toContain('(Total de casos cerrados o archivados: 1)');
    expect(texto).toContain('(Total de planes de nivelaci\xf3n: 0)');
    expect(texto).toContain('Se cuentan aparte de los casos.');
    expect(texto).toContain('solo los casos cerrados o archivados');
    expect(texto).not.toMatch(/Nombre E1|Motivo reservado|e1@ejemplo/);
    expect(DEFINICIONES_TOTALES.totalCasos).toMatch(/cerrados o archivados/);
  });
});
