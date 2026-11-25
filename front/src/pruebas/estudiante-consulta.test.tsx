import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TEXTO_SIN_PERMISO } from '../servicios-api/errores';
import { renderizar, SIN_SESION, sesionDe, simularApi } from './utilidades';

/*
 * Criterio de cierre de F1, «el estudiante consulta lo suyo» (CUD01;
 * sd_CUD01): notas, asistencia y última sincronización del periodo; alertas
 * sobre él (2.a); solicitudes con su estado (2.b, D27); «Información no
 * disponible» sin asumir valores (4.a); errores uniformes de F0.
 */

const SESION = { estado: 200, cuerpo: sesionDe('ESTUDIANTE') };

const REGISTROS = {
  registros: [
    {
      idRegistro: 'R1',
      curso: { idCurso: 'C1', nombre: 'Cálculo I', periodo: '2026-2' },
      nota: 3.45,
      porcentajeAsistencia: 87.5,
      ultimaSincronizacion: '2026-11-19T15:00:00.000Z',
    },
    {
      idRegistro: 'R2',
      curso: { idCurso: 'C2', nombre: 'Física I', periodo: '2026-2' },
      nota: 5,
      porcentajeAsistencia: 100,
      ultimaSincronizacion: null,
    },
  ],
};

const ALERTAS = [
  {
    idAlerta: 'A1',
    fecha: '2026-11-20T03:00:00.000Z',
    curso: 'Cálculo I',
    nivelRiesgo: 'MEDIO',
    descripcion: 'Bajo rendimiento en los parciales.',
  },
];

/** Dentro del contenido principal (la navegación también tiene listitem). */
function enContenido() {
  return within(screen.getByRole('main'));
}

async function consultar(periodo: string) {
  const usuario = userEvent.setup();
  const campo = await screen.findByLabelText('Periodo académico');
  if (periodo !== '') {
    await usuario.type(campo, periodo);
  }
  await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
  return usuario;
}

describe('Consulta académica (CUD01)', () => {
  it('muestra notas, asistencia y última sincronización con formato es-CO, y las alertas del periodo', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/registros?periodo=2026-2': {
        estado: 200,
        cuerpo: REGISTROS,
      },
      'GET /consulta/alertas?periodo=2026-2': { estado: 200, cuerpo: ALERTAS },
    });
    renderizar('/estudiante');
    await consultar('2026-2');

    const tarjetas = await enContenido().findAllByRole('listitem');
    const calculo = within(tarjetas[0]!);
    expect(calculo.getByText('Cálculo I')).toBeInTheDocument();
    expect(calculo.getByText('3,45')).toBeInTheDocument();
    expect(calculo.getByText('87,50 %')).toBeInTheDocument();
    expect(calculo.getByText('19/11/2026')).toBeInTheDocument();
    const fisica = within(tarjetas[1]!);
    expect(fisica.getByText('5,00')).toBeInTheDocument();
    expect(fisica.getByText('100,00 %')).toBeInTheDocument();

    const alertas = within(
      screen.getByRole('heading', { name: 'Alertas' }).closest('section')!,
    );
    // 03:00 UTC del 20 es el 19 en hora de Bogotá.
    expect(alertas.getByText('19/11/2026')).toBeInTheDocument();
    expect(alertas.getByText('Medio')).toBeInTheDocument();
    expect(
      alertas.getByText('Bajo rendimiento en los parciales.'),
    ).toBeInTheDocument();

    // La identidad sale de la sesión: solo el periodo viaja en la petición.
    const consultas = llamadas.filter((l) => l.url.includes('/consulta/'));
    expect(consultas.map((l) => l.url).sort()).toEqual([
      '/api/consulta/alertas?periodo=2026-2',
      '/api/consulta/registros?periodo=2026-2',
    ]);
    expect(consultas.every((l) => l.cuerpo === undefined)).toBe(true);
  });

  it('sin fecha de sincronización: «Información no disponible», sin asumir un valor (ER 3.3.1 y 3.3.5)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/registros?periodo=2026-2': {
        estado: 200,
        cuerpo: REGISTROS,
      },
      'GET /consulta/alertas?periodo=2026-2': { estado: 200, cuerpo: [] },
    });
    renderizar('/estudiante');
    await consultar('2026-2');
    const fisica = within((await enContenido().findAllByRole('listitem'))[1]!);
    expect(fisica.getByText('Información no disponible')).toBeInTheDocument();
  });

  it('periodo sin registros (D21, 4.a): el mensaje del backend y el vacío de alertas', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/registros?periodo=2025-1': {
        estado: 200,
        cuerpo: { registros: [], mensaje: 'Información no disponible' },
      },
      'GET /consulta/alertas?periodo=2025-1': { estado: 200, cuerpo: [] },
    });
    renderizar('/estudiante');
    await consultar('2025-1');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Información no disponible',
    );
    expect(
      screen.getByText('No hay alertas registradas para este periodo.'),
    ).toBeInTheDocument();
  });

  it('periodo vacío: «Indique el periodo académico.» junto al campo y sin consultar', async () => {
    const { llamadas } = simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/estudiante');
    await consultar('');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Indique el periodo académico.',
    );
    expect(screen.getByLabelText('Periodo académico')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(llamadas.some((l) => l.url.includes('/consulta/'))).toBe(false);
  });

  it('periodo de más de 20 caracteres: el campo no lo admite, y un 400 del backend se muestra tal cual', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/registros?periodo=2026-2': {
        estado: 400,
        cuerpo: { message: 'El texto excede la longitud permitida.' },
      },
      'GET /consulta/alertas?periodo=2026-2': { estado: 200, cuerpo: [] },
    });
    renderizar('/estudiante');
    expect(await screen.findByLabelText('Periodo académico')).toHaveAttribute(
      'maxLength',
      '20',
    );
    expect(screen.getByText('Por ejemplo: 2026-2')).toBeInTheDocument();
    await consultar('2026-2');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El texto excede la longitud permitida.',
    );
  });

  it('503: «Error al consultar la información» (sd_CUD01)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/registros?periodo=2026-2': {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
      'GET /consulta/alertas?periodo=2026-2': {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
    });
    renderizar('/estudiante');
    await consultar('2026-2');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error al consultar la información',
    );
    expect(enContenido().queryByRole('listitem')).toBeNull();
  });

  it('401 en la primera ruta protegida: al inicio de sesión con el aviso', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/registros?periodo=2026-2': SIN_SESION,
      'GET /consulta/alertas?periodo=2026-2': SIN_SESION,
    });
    renderizar('/estudiante');
    await consultar('2026-2');
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
  });
});

describe('Mis solicitudes (CUD01 2.b, D27)', () => {
  it('cada solicitud con fecha, tipo, motivo, estado «Pendiente» o «Atendida» y código de rastreo', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/solicitudes': {
        estado: 200,
        cuerpo: [
          {
            codigo: 'cod-1',
            fecha: '2026-11-18T14:00:00.000Z',
            tipoApoyo: 'ACADEMICA',
            motivo: 'Dificultad con Cálculo I',
            disponibilidad: 'Martes en la tarde',
            estado: 'PENDIENTE',
          },
          {
            codigo: 'cod-2',
            fecha: '2026-10-01T14:00:00.000Z',
            tipoApoyo: 'PSICOLOGICA',
            motivo: 'Ansiedad',
            disponibilidad: '',
            estado: 'ATENDIDA',
          },
        ],
      },
    });
    renderizar('/estudiante/solicitudes');
    await screen.findByRole('heading', { level: 1, name: 'Mis solicitudes' });
    const [primera, segunda] = await enContenido().findAllByRole('listitem');
    const a = within(primera!);
    expect(a.getByText('18/11/2026')).toBeInTheDocument();
    expect(a.getByText('Académico')).toBeInTheDocument();
    expect(a.getByText('Dificultad con Cálculo I')).toBeInTheDocument();
    expect(a.getByText('Martes en la tarde')).toBeInTheDocument();
    expect(a.getByText('Pendiente')).toBeInTheDocument();
    expect(a.getByText('cod-1')).toBeInTheDocument();
    const b = within(segunda!);
    expect(b.getByText('Psicosocial')).toBeInTheDocument();
    expect(b.getByText('Atendida')).toBeInTheDocument();
    // Disponibilidad vacía (opcional): sin fila.
    expect(b.queryByText('Disponibilidad horaria')).toBeNull();
  });

  it('sin solicitudes: «Aún no ha registrado solicitudes.»', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/solicitudes': { estado: 200, cuerpo: [] },
    });
    renderizar('/estudiante/solicitudes');
    expect(
      await screen.findByText('Aún no ha registrado solicitudes.'),
    ).toBeInTheDocument();
  });

  it('503: «Error al consultar la información»', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/solicitudes': {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
    });
    renderizar('/estudiante/solicitudes');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error al consultar la información',
    );
  });

  it('403 en la consulta: siempre el texto de F0 (la excepción es solo de POST /solicitudes)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/solicitudes': {
        estado: 403,
        cuerpo: {
          message: 'No se encontró una matrícula activa asociada a su cuenta.',
        },
      },
    });
    renderizar('/estudiante/solicitudes');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      TEXTO_SIN_PERMISO,
    );
  });
});

describe('Navegación del Estudiante (respuesta 2)', () => {
  it('«Inicio» y tres funciones (D4a); el de la pantalla actual con aria-current', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/solicitudes': { estado: 200, cuerpo: [] },
    });
    renderizar('/estudiante');
    const navegacion = await screen.findByRole('navigation');
    const enlaces = within(navegacion).getAllByRole('link');
    expect(enlaces.map((e) => e.textContent)).toEqual([
      'Inicio',
      'Consulta académica',
      'Mis solicitudes',
      'Solicitar acompañamiento',
    ]);
    expect(enlaces[0]).not.toHaveAttribute('aria-current');
    expect(enlaces[1]).toHaveAttribute('aria-current', 'page');
    expect(enlaces[2]).not.toHaveAttribute('aria-current');

    await userEvent.setup().click(enlaces[2]!);
    expect(screen.getByTestId('ruta')).toHaveTextContent(
      '/estudiante/solicitudes',
    );
    await waitFor(() =>
      expect(document.title).toBe('Mis solicitudes · DETECTA'),
    );
  });

  it('nada se guarda en localStorage ni en sessionStorage durante la consulta', async () => {
    const escribir = vi.spyOn(Storage.prototype, 'setItem');
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/registros?periodo=2026-2': {
        estado: 200,
        cuerpo: REGISTROS,
      },
      'GET /consulta/alertas?periodo=2026-2': { estado: 200, cuerpo: ALERTAS },
      'GET /consulta/solicitudes': { estado: 200, cuerpo: [] },
    });
    renderizar('/estudiante');
    await consultar('2026-2');
    await enContenido().findAllByRole('listitem');
    expect(escribir).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });
});
