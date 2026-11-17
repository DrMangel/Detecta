import { Logger } from '@nestjs/common';
import { CasoRiesgo } from '../../dominio/entidades/caso-riesgo';
import { Cita } from '../../dominio/entidades/cita';
import { Curso } from '../../dominio/entidades/curso';
import { Docente } from '../../dominio/entidades/docente';
import { EstadoCita } from '../../dominio/entidades/estado-cita';
import { EstadoPlan } from '../../dominio/entidades/estado-plan';
import { Estudiante } from '../../dominio/entidades/estudiante';
import { JefeDepartamento } from '../../dominio/entidades/jefe-departamento';
import { Modalidad } from '../../dominio/entidades/modalidad';
import { NivelRiesgo } from '../../dominio/entidades/nivel-riesgo';
import { PlanNivelacion } from '../../dominio/entidades/plan-nivelacion';
import { Programa } from '../../dominio/entidades/programa';
import { Psicologo } from '../../dominio/entidades/psicologo';
import { RegistroAcademico } from '../../dominio/entidades/registro-academico';
import { RutaAtencion } from '../../dominio/entidades/ruta-atencion';
import {
  ErrorEnvioCorreo,
  type ProveedorCorreo,
} from '../contratos/proveedor-correo';
import { ServicioNotificacion } from './servicio-notificacion';

const URL = 'http://localhost:5173';
const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
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
const docente = new Docente({
  id: 'D1',
  nombre: 'Docente',
  correo: 'docente@ejemplo.edu.co',
  contrasenaHash: 'hash',
  cursos: [curso],
});
const psicologo = new Psicologo({
  id: 'PS1',
  nombre: 'Psicóloga',
  correo: 'psicologa@ejemplo.edu.co',
  contrasenaHash: 'hash',
  citas: [],
});
const jefe = new JefeDepartamento({
  id: 'J1',
  nombre: 'Jefe',
  correo: 'jefe@ejemplo.edu.co',
  contrasenaHash: 'hash',
  programa,
});
const MOTIVO = 'Motivo confidencial del caso';
const DESCRIPCION_ALERTA = 'Descripción confidencial de la alerta';

function alerta() {
  const registro = new RegistroAcademico({
    idRegistro: 'R1',
    nota: 2.1,
    porcentajeAsistencia: 60,
    estudiante,
    curso,
  });
  return docente.emitirAlerta(registro, NivelRiesgo.ALTO, DESCRIPCION_ALERTA);
}

function caso(): CasoRiesgo {
  return estudiante
    .solicitarAcompanamiento(RutaAtencion.ACADEMICA, MOTIVO, 'Martes')
    .generarCasoRiesgo();
}

const cita = new Cita({
  idCita: 'CI1',
  fechaHora: new Date('2026-11-20T19:30:00Z'),
  modalidad: Modalidad.PRESENCIAL,
  estado: EstadoCita.PROGRAMADA,
  asesoria: null,
});

function plan(): PlanNivelacion {
  return new PlanNivelacion({
    idPlan: 'PL1',
    descripcion: 'Descripción confidencial del plan',
    fecha: new Date(2026, 10, 17),
    cronograma: 'Cronograma confidencial',
    tutorNombre: 'Tutor',
    tutorCodigo: 'T1',
    estado: EstadoPlan.ACTIVO,
    caso: caso(),
    cursos: [curso],
  });
}

function crear(enviar: jest.Mock) {
  const correo = { enviar } as unknown as ProveedorCorreo;
  return new ServicioNotificacion(correo, { urlFrontend: URL });
}

/** Captura todo lo que el servicio registra, en cualquier nivel. */
function capturarRegistro() {
  const lineas: string[] = [];
  const espias = (['log', 'warn', 'error'] as const).map((nivel) =>
    jest
      .spyOn(Logger.prototype, nivel)
      .mockImplementation((...[mensaje]: unknown[]) => {
        lineas.push(`${nivel}: ${String(mensaje)}`);
      }),
  );
  return {
    lineas,
    restaurar: () => espias.forEach((espia) => espia.mockRestore()),
  };
}

describe('ServicioNotificacion (B5, ER Tabla 1)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('notificarAlertaEstudiante: al estudiante, con el curso y sin la descripción', async () => {
    const enviar = jest.fn().mockResolvedValue(true);
    await crear(enviar).notificarAlertaEstudiante(alerta());
    const [destino, asunto, cuerpo] = enviar.mock.calls[0] as string[];
    expect(destino).toBe('ana@ejemplo.edu.co');
    expect(asunto).toBe('DETECTA: nueva alerta académica');
    expect(cuerpo).toContain('Cálculo');
    expect(cuerpo).not.toContain(DESCRIPCION_ALERTA);
    expect(cuerpo).not.toMatch(/ALTO/);
  });

  it('notificarCasoRemitido: un correo por destinatario, sin motivo ni estudiante', async () => {
    const enviar = jest.fn().mockResolvedValue(true);
    await crear(enviar).notificarCasoRemitido(caso(), [psicologo, jefe]);
    expect(enviar.mock.calls.map((llamada) => llamada[0])).toEqual([
      'psicologa@ejemplo.edu.co',
      'jefe@ejemplo.edu.co',
    ]);
    for (const [, asunto, cuerpo] of enviar.mock.calls as string[][]) {
      expect(`${asunto} ${cuerpo}`).not.toContain(MOTIVO);
      expect(`${asunto} ${cuerpo}`).not.toContain('Ana');
    }
  });

  it('notificarCita(cita, destinatario): al destinatario indicado', async () => {
    const enviar = jest.fn().mockResolvedValue(true);
    await crear(enviar).notificarCita(cita, estudiante);
    const [destino, asunto] = enviar.mock.calls[0] as string[];
    expect(destino).toBe('ana@ejemplo.edu.co');
    expect(asunto).toBe('DETECTA: cita programada');
  });

  it('notificarPlanNivelacion: al estudiante del caso, sin descripción, cronograma ni cursos', async () => {
    const enviar = jest.fn().mockResolvedValue(true);
    await crear(enviar).notificarPlanNivelacion(plan());
    const [destino, asunto, cuerpo] = enviar.mock.calls[0] as string[];
    expect(destino).toBe('ana@ejemplo.edu.co');
    expect(asunto).toBe('DETECTA: plan de nivelación académica');
    expect(cuerpo).not.toMatch(/confidencial|Cálculo|Tutor/);
  });

  it('registra "Correo enviado" con el tipo y sin destinatario, asunto ni cuerpo (respuesta 7)', async () => {
    const registro = capturarRegistro();
    await crear(jest.fn().mockResolvedValue(true)).notificarCita(
      cita,
      estudiante,
    );
    expect(registro.lineas).toEqual(['log: Correo enviado (cita)']);
    registro.restaurar();
  });

  it('ante un fallo registra "Error de envío" con el código y NO lanza (respuesta 3)', async () => {
    const registro = capturarRegistro();
    const enviar = jest
      .fn()
      .mockRejectedValue(new ErrorEnvioCorreo('EAUTH', 535));
    await expect(
      crear(enviar).notificarAlertaEstudiante(alerta()),
    ).resolves.toBeUndefined();
    expect(registro.lineas).toEqual(['error: Error de envío (alerta): EAUTH']);
    registro.restaurar();
  });

  it('un error inesperado se registra como DESCONOCIDO, sin su mensaje', async () => {
    const registro = capturarRegistro();
    const enviar = jest
      .fn()
      .mockRejectedValue(new Error('fallo para ana@ejemplo.edu.co'));
    await expect(
      crear(enviar).notificarPlanNivelacion(plan()),
    ).resolves.toBeUndefined();
    expect(registro.lineas).toEqual([
      'error: Error de envío (plan-nivelacion): DESCONOCIDO',
    ]);
    registro.restaurar();
  });

  it('un fallo con un destinatario no impide notificar al siguiente', async () => {
    const registro = capturarRegistro();
    const enviar = jest
      .fn()
      .mockRejectedValueOnce(new ErrorEnvioCorreo('PLAZO_AGOTADO'))
      .mockResolvedValueOnce(true);
    await crear(enviar).notificarCasoRemitido(caso(), [psicologo, jefe]);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(registro.lineas).toEqual([
      'error: Error de envío (caso-remitido): PLAZO_AGOTADO',
      'log: Correo enviado (caso-remitido)',
    ]);
    expect(registro.lineas.join('\n')).not.toContain('@');
    registro.restaurar();
  });

  it('con el correo desactivado registra "Error de envío" NO_ENVIADO', async () => {
    const registro = capturarRegistro();
    await crear(jest.fn().mockResolvedValue(false)).notificarCita(
      cita,
      psicologo,
    );
    expect(registro.lineas).toEqual([
      'warn: Error de envío (cita): NO_ENVIADO',
    ]);
    registro.restaurar();
  });
});
