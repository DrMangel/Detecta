import { HttpException, Logger } from '@nestjs/common';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import type { GeneradorInformeRiesgo } from '../aplicacion/servicios/generador-informe-riesgo';
import { Curso } from '../dominio/entidades/curso';
import { Docente } from '../dominio/entidades/docente';
import { Estudiante } from '../dominio/entidades/estudiante';
import { InformeRiesgo } from '../dominio/entidades/informe-riesgo';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import type { Persona } from '../dominio/entidades/persona';
import { Programa } from '../dominio/entidades/programa';
import { Psicologo } from '../dominio/entidades/psicologo';
import { ControladorInformes, MENSAJES_INFORMES } from './controlador-informes';
import {
  MENSAJE_PERIODO_OBLIGATORIO,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
const base = (id: string) => ({
  id,
  nombre: `Nombre ${id}`,
  correo: `${id.toLowerCase()}@ejemplo.edu.co`,
  contrasenaHash: 'h',
});
const curso = new Curso({
  idCurso: 'C1',
  nombre: 'Cálculo',
  periodo: '2026-2',
  ultimaSincronizacion: null,
  estudiantes: [],
});
const jefe = new JefeDepartamento({ ...base('J1'), programa });
const psicologo = new Psicologo({ ...base('PS1'), citas: [] });
const docente = new Docente({ ...base('D1'), cursos: [] });
const estudiante = new Estudiante({
  ...base('E1'),
  fechaNacimiento: new Date(2000, 0, 1),
  programa,
});

function informe(): InformeRiesgo {
  const valor = new InformeRiesgo({
    idInforme: 'I1',
    fecha: new Date('2026-11-18T15:00:00Z'),
    periodo: '2026-2',
    totalAlertas: 0,
    totalCasos: 0,
    totalPlanes: 0,
    resumen: '',
    curso,
    casos: [],
    planes: [],
    alertas: [],
  });
  valor.consolidar();
  return valor;
}

function preparar(
  generado: InformeRiesgo | null = informe(),
  programaGuardado = 'P1',
) {
  const repos = {
    cursos: {
      buscarPorId: jest.fn(async (id: string) => (id === 'C1' ? curso : null)),
    },
    informes: {
      buscarPorId: jest.fn(async (id: string) =>
        id === 'I1' ? informe() : null,
      ),
      buscarProgramaDelInforme: jest.fn(async () => programaGuardado),
    },
  };
  const generador = {
    generar: jest.fn(async () => generado),
    exportar: jest.fn(() => ({
      nombre: 'informe-riesgo.pdf',
      tipoContenido: 'application/pdf',
      contenido: Buffer.from('%PDF-1.4'),
    })),
  };
  const controlador = new ControladorInformes(
    new ControlAcceso(),
    repos.cursos as never,
    repos.informes as never,
    generador as unknown as GeneradorInformeRiesgo,
  );
  const http = {
    codigo: 0,
    cabeceras: {} as Record<string, string>,
    cuerpo: Buffer.alloc(0) as Buffer,
    status(codigo: number) {
      this.codigo = codigo;
      return this;
    },
    set(cabeceras: Record<string, string>) {
      this.cabeceras = cabeceras;
      return this;
    },
    send(cuerpo: Buffer) {
      this.cuerpo = cuerpo;
    },
  };
  return { controlador, repos, generador, http };
}

async function errorDe(
  promesa: Promise<unknown>,
): Promise<{ estado: number; mensaje: string }> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse() as { message?: string } | string;
      return {
        estado: error.getStatus(),
        mensaje: typeof cuerpo === 'string' ? cuerpo : (cuerpo.message ?? ''),
      };
    }
    throw error;
  }
  throw new Error('se esperaba un error HTTP');
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('ControladorInformes: permisos', () => {
  it.each(
    [docente, estudiante].map((p) => [p.obtenerRol(), p] as [string, Persona]),
  )('%s recibe 403', async (_rol, persona) => {
    const { controlador, http } = preparar();
    expect(
      (
        await errorDe(
          controlador.generarInforme(
            persona,
            { periodo: '2026-2', idCurso: 'C1' },
            http,
          ),
        )
      ).estado,
    ).toBe(403);
    expect(
      (await errorDe(controlador.exportarInforme(persona, 'I1', http))).estado,
    ).toBe(403);
  });
});

describe('ControladorInformes.generarInforme (sd_CUD10; ajuste C)', () => {
  it('Jefe: usa el programa que dirige; 201 con totales, resumen y definiciones', async () => {
    const { controlador, generador, http } = preparar();
    const respuesta = await controlador.generarInforme(
      jefe,
      { periodo: '2026-2', idCurso: 'C1' },
      http,
    );
    expect(http.codigo).toBe(201);
    expect(generador.generar).toHaveBeenCalledWith('2026-2', 'P1', curso, jefe);
    expect(respuesta).toMatchObject({
      informe: {
        idPrograma: 'P1',
        totalAlertas: 0,
        curso: { idCurso: 'C1', nombre: 'Cálculo' },
      },
    });
    expect(JSON.stringify(respuesta)).toMatch(/cerrados o archivados/);
  });

  it('Psicólogo: idPrograma obligatorio y usado', async () => {
    const { controlador, generador, http } = preparar();
    await controlador.generarInforme(
      psicologo,
      { periodo: '2026-2', idPrograma: 'P2', idCurso: 'C1' },
      http,
    );
    expect(generador.generar).toHaveBeenCalledWith(
      '2026-2',
      'P2',
      curso,
      psicologo,
    );
    expect(
      await errorDe(
        controlador.generarInforme(
          psicologo,
          { periodo: '2026-2', idCurso: 'C1' },
          http,
        ),
      ),
    ).toEqual({
      estado: 400,
      mensaje: MENSAJE_SOLICITUD_NO_VALIDA,
    });
  });

  it('Jefe con idPrograma: 400 «La solicitud no es válida.»', async () => {
    const { controlador, http } = preparar();
    expect(
      await errorDe(
        controlador.generarInforme(
          jefe,
          { periodo: '2026-2', idPrograma: 'P1', idCurso: 'C1' },
          http,
        ),
      ),
    ).toEqual({ estado: 400, mensaje: MENSAJE_SOLICITUD_NO_VALIDA });
  });

  it('sin datos: 200 con «No hay datos para el periodo seleccionado» (respuestas 8 y 9)', async () => {
    const { controlador, http } = preparar(null);
    expect(
      await controlador.generarInforme(
        jefe,
        { periodo: '2026-2', idCurso: 'C1' },
        http,
      ),
    ).toEqual({
      mensaje: MENSAJES_INFORMES.sinDatos,
    });
    expect(http.codigo).toBe(200);
  });

  it.each([
    [{ idCurso: 'C1' }, MENSAJE_PERIODO_OBLIGATORIO],
    [{ periodo: '2026-2' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ periodo: '2026-2', idCurso: 'NO-EXISTE' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [{ periodo: 2026, idCurso: 'C1' }, MENSAJE_SOLICITUD_NO_VALIDA],
    [
      { periodo: '2026-2', idCurso: 'C1', extra: 1 },
      MENSAJE_SOLICITUD_NO_VALIDA,
    ],
  ])('entrada inválida %j: 400', async (cuerpo, mensaje) => {
    const { controlador, http } = preparar();
    expect(
      await errorDe(controlador.generarInforme(jefe, cuerpo, http)),
    ).toEqual({ estado: 400, mensaje });
  });

  it('error de persistencia: 503 «Error al generar el informe»', async () => {
    const { controlador, generador, http } = preparar();
    generador.generar.mockRejectedValue(new Error('caída'));
    expect(
      await errorDe(
        controlador.generarInforme(
          jefe,
          { periodo: '2026-2', idCurso: 'C1' },
          http,
        ),
      ),
    ).toEqual({
      estado: 503,
      mensaje: MENSAJES_INFORMES.error,
    });
  });
});

describe('ControladorInformes.exportarInforme (respuesta 4; ajuste A)', () => {
  it('PDF como adjunto con nombre fijo', async () => {
    const { controlador, http } = preparar();
    await controlador.exportarInforme(psicologo, 'I1', http);
    expect(http.codigo).toBe(200);
    expect(http.cabeceras).toMatchObject({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="informe-riesgo.pdf"',
    });
    expect(http.cuerpo.toString('latin1')).toBe('%PDF-1.4');
  });

  it('el Psicólogo exporta cualquier informe; el Jefe solo los de su programa', async () => {
    const otro = preparar(informe(), 'P2');
    await expect(
      otro.controlador.exportarInforme(psicologo, 'I1', otro.http),
    ).resolves.toBeUndefined();
    expect(
      (await errorDe(otro.controlador.exportarInforme(jefe, 'I1', otro.http)))
        .estado,
    ).toBe(403);
    const propio = preparar(informe(), 'P1');
    await expect(
      propio.controlador.exportarInforme(jefe, 'I1', propio.http),
    ).resolves.toBeUndefined();
  });

  it('informe inexistente: 403', async () => {
    const { controlador, http } = preparar();
    expect(
      (await errorDe(controlador.exportarInforme(psicologo, 'NO', http)))
        .estado,
    ).toBe(403);
  });
});
