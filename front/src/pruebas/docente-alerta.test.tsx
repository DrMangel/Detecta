import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TEXTO_ERROR_RED, TEXTO_SIN_PERMISO } from '../servicios-api/errores';
import { CURSO, ID_ESTUDIANTE_SECRETO } from './datos-docente';
import {
  renderizar,
  SIN_SESION,
  sesionDe,
  simularApi,
  type LlamadaRegistrada,
  type RespuestaSimulada,
} from './utilidades';

/*
 * Criterio de cierre de F2, «emite una alerta completa» (CUD03; R01;
 * sd_CUD03): nivel de riesgo sin valor por defecto y justificación con
 * contador (ajuste A); campos vacíos bloquean el envío (6.a); foco al abrir y
 * de vuelta al cerrar o tras la confirmación (ajuste B); doble envío;
 * errores con los textos de sd_CUD03 (respuesta 2).
 */

const SESION = { estado: 200, cuerpo: sesionDe('DOCENTE') };
const CURSO_RUTA = 'GET /alertas/cursos/IS-101';
const EMITIDAS = 'GET /alertas/emitidas?periodo=2026-2';
const EMITIR = 'POST /alertas';
const JUSTIFICACION = 'Inasistencias en las últimas tres semanas.';

function alerta(
  idAlerta: string,
  cambios: Partial<{ descripcion: string; nivelRiesgo: string }> = {},
) {
  return {
    idAlerta,
    fecha: '2026-11-19T15:00:00.000Z',
    curso: { idCurso: 'IS-101', nombre: 'Ingeniería de Software I' },
    estudiante: { id: ID_ESTUDIANTE_SECRETO, nombre: 'Ana Pérez' },
    nivelRiesgo: 'MEDIO',
    descripcion: JUSTIFICACION,
    estadoAtencion: 'PENDIENTE',
    ...cambios,
  };
}

const SIN_ALERTAS: RespuestaSimulada = { estado: 200, cuerpo: [] };
const EMITIDA: RespuestaSimulada = {
  estado: 201,
  cuerpo: {
    mensaje: 'Alerta emitida y remitida al Jefe de Departamento',
    alerta: alerta('A-nueva'),
  },
};

function envios(llamadas: LlamadaRegistrada[]) {
  return llamadas.filter(
    (l) => l.metodo === 'POST' && l.url === '/api/alertas',
  );
}

function botonFila(nombre: string) {
  const fila = screen.getByRole('rowheader', { name: nombre }).closest('tr')!;
  return within(fila).getByRole('button', { name: 'Emitir alerta' });
}

function formulario() {
  return within(screen.getByRole('region', { name: 'Emitir alerta' }));
}

async function abrir(nombre = 'Ana Pérez') {
  const usuario = userEvent.setup();
  await screen.findByRole('table');
  await usuario.click(botonFila(nombre));
  await screen.findByRole('region', { name: 'Emitir alerta' });
  return usuario;
}

async function diligenciar(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(formulario().getByRole('radio', { name: 'Medio' }));
  await usuario.type(
    formulario().getByLabelText('Justificación'),
    JUSTIFICACION,
  );
}

function enviar(usuario: ReturnType<typeof userEvent.setup>) {
  return usuario.click(
    formulario().getByRole('button', { name: 'Emitir alerta' }),
  );
}

describe('Formulario de alerta (CUD03 pasos 4 a 6)', () => {
  it('muestra el estudiante y el registro que sustenta la alerta; el foco pasa al formulario (ajuste B)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
    });
    renderizar('/docente/cursos/IS-101');
    await abrir();
    const region = screen.getByRole('region', { name: 'Emitir alerta' });
    expect(region).toHaveFocus();
    const datos = formulario();
    expect(datos.getByText('Ana Pérez')).toBeInTheDocument();
    expect(datos.getByText('Ingeniería de Software I')).toBeInTheDocument();
    expect(datos.getByText('1,87')).toBeInTheDocument();
    expect(datos.getByText('53,00 %')).toBeInTheDocument();
  });

  it('nivel de riesgo sin valor por defecto; justificación de 2000 con contador y sin autocompletado (ajuste A)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    for (const nivel of ['Bajo', 'Medio', 'Alto']) {
      expect(
        formulario().getByRole('radio', { name: nivel }),
      ).not.toBeChecked();
    }
    const justificacion = formulario().getByLabelText('Justificación');
    expect(justificacion).toHaveAttribute('maxLength', '2000');
    expect(justificacion).toHaveAttribute('autocomplete', 'off');
    expect(justificacion).toHaveAccessibleDescription('0 / 2000');
    await usuario.type(justificacion, 'Hola');
    expect(justificacion).toHaveAccessibleDescription('4 / 2000');
  });

  it.each([
    ['sin nivel', false, JUSTIFICACION],
    ['sin justificación', true, ''],
    ['justificación solo con espacios', true, '   '],
  ])(
    '%s (6.a): «Complete el nivel de riesgo y la justificación» y no se envía',
    async (_caso, conNivel, texto) => {
      const { llamadas } = simularApi({
        'GET /acceso/sesion': SESION,
        [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      });
      renderizar('/docente/cursos/IS-101');
      const usuario = await abrir();
      if (conNivel) {
        await usuario.click(formulario().getByRole('radio', { name: 'Alto' }));
      }
      if (texto !== '') {
        await usuario.type(formulario().getByLabelText('Justificación'), texto);
      }
      await enviar(usuario);
      expect(await formulario().findByRole('alert')).toHaveTextContent(
        'Complete el nivel de riesgo y la justificación',
      );
      expect(llamadas.some((l) => l.url.startsWith('/api/alertas?'))).toBe(
        false,
      );
      expect(envios(llamadas)).toHaveLength(0);
    },
  );
});

describe('Emisión y foco (CUD03 pasos 7 y 8; ajuste B)', () => {
  it('201: «Alerta emitida y remitida al Jefe de Departamento», cuerpo exacto y el foco vuelve al botón de la fila', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: SIN_ALERTAS,
      [EMITIR]: EMITIDA,
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Alerta emitida y remitida al Jefe de Departamento',
    );
    expect(screen.queryByRole('region', { name: 'Emitir alerta' })).toBeNull();
    await waitFor(() => expect(botonFila('Ana Pérez')).toHaveFocus());
    expect(envios(llamadas)).toHaveLength(1);
    expect(envios(llamadas)[0]?.cuerpo).toEqual({
      idRegistro: 'a1b2c3d4-0000-4000-8000-000000000001',
      nivelRiesgo: 'MEDIO',
      descripcion: JUSTIFICACION,
    });
  });

  it('«Cancelar» cierra sin emitir y el foco vuelve al botón que lo abrió', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir('Luis Gómez');
    await usuario.click(formulario().getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('region', { name: 'Emitir alerta' })).toBeNull();
    await waitFor(() => expect(botonFila('Luis Gómez')).toHaveFocus());
    expect(envios(llamadas)).toHaveLength(0);
  });

  it('elegir otro estudiante abre un formulario nuevo y vacío con el foco en él', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir('Ana Pérez');
    await usuario.type(formulario().getByLabelText('Justificación'), 'x');
    await usuario.click(botonFila('Luis Gómez'));
    await waitFor(() =>
      expect(formulario().getByText('Luis Gómez')).toBeInTheDocument(),
    );
    expect(formulario().getByLabelText('Justificación')).toHaveValue('');
    expect(screen.getByRole('region', { name: 'Emitir alerta' })).toHaveFocus();
  });
});

describe('Doble envío de la alerta (§5 del plan)', () => {
  it('el botón queda deshabilitado mientras se envía; un segundo clic no envía otra vez', async () => {
    let responder: (r: RespuestaSimulada) => void = () => undefined;
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: SIN_ALERTAS,
      [EMITIR]: () =>
        new Promise<RespuestaSimulada>((resolver) => {
          responder = resolver;
        }),
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    await waitFor(() => expect(envios(llamadas)).toHaveLength(1));
    const boton = formulario().getByRole('button', { name: 'Emitir alerta' });
    expect(boton).toBeDisabled();
    await usuario.click(boton);
    responder(EMITIDA);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Alerta emitida y remitida al Jefe de Departamento',
    );
    expect(envios(llamadas)).toHaveLength(1);
  });

  it('error de red y la alerta sí quedó registrada: la confirmación, sin reenviar', async () => {
    let consultas = 0;
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: () => {
        consultas += 1;
        return {
          estado: 200,
          cuerpo:
            consultas === 1
              ? [alerta('A-vieja', { descripcion: 'Otra' })]
              : [alerta('A-vieja', { descripcion: 'Otra' }), alerta('A-nueva')],
        };
      },
      [EMITIR]: 'red',
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Alerta emitida y remitida al Jefe de Departamento',
    );
    expect(envios(llamadas)).toHaveLength(1);
    expect(consultas).toBe(2);
  });

  it('error de red y no quedó registrada: el error de red y lo escrito se conserva', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      // Una idéntica ya existía antes: no cuenta como registrada ahora.
      [EMITIDAS]: { estado: 200, cuerpo: [alerta('A-vieja')] },
      [EMITIR]: 'red',
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    expect(await formulario().findByRole('alert')).toHaveTextContent(
      TEXTO_ERROR_RED,
    );
    expect(formulario().getByLabelText('Justificación')).toHaveValue(
      JUSTIFICACION,
    );
    expect(formulario().getByRole('radio', { name: 'Medio' })).toBeChecked();
  });

  it('la consulta previa falla: no bloquea la emisión', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
      [EMITIR]: EMITIDA,
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Alerta emitida y remitida al Jefe de Departamento',
    );
    expect(envios(llamadas)).toHaveLength(1);
  });

  it('la consulta previa falla y luego hay error de red: el texto de resultado incierto', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: 'red',
      [EMITIR]: 'red',
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    expect(await formulario().findByRole('alert')).toHaveTextContent(
      'No se pudo confirmar si la alerta fue registrada. Revise «Alertas emitidas» antes de emitirla de nuevo.',
    );
  });

  it('error de red y la verificación posterior también falla: el texto de resultado incierto', async () => {
    let consultas = 0;
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: () => {
        consultas += 1;
        return consultas === 1 ? SIN_ALERTAS : 'red';
      },
      [EMITIR]: 'red',
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    expect(await formulario().findByRole('alert')).toHaveTextContent(
      /^No se pudo confirmar si la alerta fue registrada\./,
    );
    expect(formulario().getByLabelText('Justificación')).toHaveValue(
      JUSTIFICACION,
    );
  });
});

describe('Errores al emitir (sd_CUD03 *.a, *.b y ER 3.5.3)', () => {
  it('503: «Error al registrar la alerta» y lo escrito se conserva', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: SIN_ALERTAS,
      [EMITIR]: {
        estado: 503,
        cuerpo: { message: 'Error al registrar la alerta' },
      },
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    expect(await formulario().findByRole('alert')).toHaveTextContent(
      'Error al registrar la alerta',
    );
    expect(formulario().getByLabelText('Justificación')).toHaveValue(
      JUSTIFICACION,
    );
  });

  it('403: «El estudiante no pertenece a un curso asignado» (respuesta 2)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: SIN_ALERTAS,
      [EMITIR]: {
        estado: 403,
        cuerpo: {
          message: 'El estudiante no pertenece a un curso asignado',
          error: 'Forbidden',
          statusCode: 403,
        },
      },
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    expect(await formulario().findByRole('alert')).toHaveTextContent(
      'El estudiante no pertenece a un curso asignado',
    );
  });

  it('otro 403 en POST /alertas: el texto de F0', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: SIN_ALERTAS,
      [EMITIR]: { estado: 403, cuerpo: { message: 'Forbidden' } },
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    expect(await formulario().findByRole('alert')).toHaveTextContent(
      TEXTO_SIN_PERMISO,
    );
  });

  it('401 durante el diligenciamiento (*.b): al inicio de sesión con el aviso; el borrador no se conserva', async () => {
    let sesionVigente = true;
    simularApi({
      'GET /acceso/sesion': () => (sesionVigente ? SESION : SIN_SESION),
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: SIN_ALERTAS,
      [EMITIR]: () => {
        sesionVigente = false;
        return SIN_SESION;
      },
      'POST /acceso/iniciar-sesion': SESION,
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
    expect(screen.queryByDisplayValue(JUSTIFICACION)).toBeNull();
  });

  it('nada se guarda en localStorage ni en sessionStorage al emitir', async () => {
    const escribir = vi.spyOn(Storage.prototype, 'setItem');
    simularApi({
      'GET /acceso/sesion': SESION,
      [CURSO_RUTA]: { estado: 200, cuerpo: CURSO },
      [EMITIDAS]: SIN_ALERTAS,
      [EMITIR]: EMITIDA,
    });
    renderizar('/docente/cursos/IS-101');
    const usuario = await abrir();
    await diligenciar(usuario);
    await enviar(usuario);
    await screen.findByRole('status');
    expect(escribir).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });
});
