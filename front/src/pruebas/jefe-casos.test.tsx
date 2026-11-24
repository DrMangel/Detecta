import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TEXTO_ERROR_RED } from '../servicios-api/errores';
import {
  CASO_ACADEMICO,
  CASO_ALERTA,
  CASO_SOLICITUD,
  DETALLE_ALERTA,
  ID_CASO_SECRETO,
  ID_ESTUDIANTE_SECRETO,
} from './datos-jefe';
import { renderizar, sesionDe, simularApi } from './utilidades';

/*
 * Criterio de cierre de F3, «el caso se canaliza a su ruta; el Jefe nunca ve
 * solicitudes psicosociales» (CUD04; sd_CUD04; D18; ajuste A de F3).
 */

const SESION = { estado: 200, cuerpo: sesionDe('JEFE_DEPARTAMENTO') };
const DETALLE = `GET /casos/${ID_CASO_SECRETO}`;
const CANALIZAR = `POST /casos/${ID_CASO_SECRETO}/canalizacion`;
const RUTA_DETALLE = `/jefe-departamento/casos/${ID_CASO_SECRETO}`;

describe('Bandeja de casos pendientes (CUD04)', () => {
  it('lista los casos con estudiante, fecha, origen y nivel; la solicitud sin nivel', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/pendientes': {
        estado: 200,
        cuerpo: [CASO_ALERTA, CASO_SOLICITUD],
      },
    });
    renderizar('/jefe-departamento');
    const tabla = await screen.findByRole('table');
    const laura = within(tabla).getByRole('rowheader', { name: 'Laura Gómez' });
    const fila = within(laura.closest('tr')!);
    expect(fila.getByText('Alerta académica temprana')).toBeInTheDocument();
    expect(fila.getByText('Alto')).toBeInTheDocument();
    const pedro = within(tabla).getByRole('rowheader', { name: 'Pedro Tres' });
    expect(
      within(pedro.closest('tr')!).getByText('Solicitud de acompañamiento'),
    ).toBeInTheDocument();
    expect(within(pedro.closest('tr')!).getByText('—')).toBeInTheDocument();
  });

  it('sin casos: «No hay casos pendientes»', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/pendientes': { estado: 200, cuerpo: [] },
    });
    renderizar('/jefe-departamento');
    expect(
      await screen.findByText('No hay casos pendientes'),
    ).toBeInTheDocument();
  });

  it('error de la consulta: el texto del backend', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/pendientes': {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
    });
    renderizar('/jefe-departamento');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error al consultar la información',
    );
  });

  it('el botón de la fila lleva al detalle; ningún id de la base queda en el DOM', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/pendientes': { estado: 200, cuerpo: [CASO_ALERTA] },
      [DETALLE]: { estado: 200, cuerpo: DETALLE_ALERTA },
    });
    renderizar('/jefe-departamento');
    const boton = await screen.findByRole('button', {
      name: 'Detalle del caso',
    });
    expect(boton).toHaveAccessibleDescription('Laura Gómez');
    expect(document.body.innerHTML).not.toContain(ID_CASO_SECRETO);
    expect(document.body.innerHTML).not.toContain(ID_ESTUDIANTE_SECRETO);
    await userEvent.setup().click(boton);
    expect(await screen.findByTestId('ruta')).toHaveTextContent(RUTA_DETALLE);
  });
});

describe('Bandeja «En ruta académica» (F5b, D38)', () => {
  it('el enlace de la navegación lleva a los casos en ruta académica y cada fila a su detalle, sin ids en el DOM', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/pendientes': { estado: 200, cuerpo: [] },
      'GET /casos/ruta-academica': { estado: 200, cuerpo: [CASO_ACADEMICO] },
      [DETALLE]: {
        estado: 200,
        cuerpo: { ...DETALLE_ALERTA, caso: CASO_ACADEMICO },
      },
    });
    renderizar('/jefe-departamento');
    const usuario = userEvent.setup();
    await usuario.click(
      await screen.findByRole('link', { name: 'En ruta académica' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'En ruta académica' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'En ruta académica' }),
    ).toHaveAttribute('aria-current', 'page');
    const tabla = await screen.findByRole('table');
    expect(
      within(tabla).getByRole('rowheader', { name: 'Laura Gómez' }),
    ).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(ID_CASO_SECRETO);
    expect(document.body.innerHTML).not.toContain(ID_ESTUDIANTE_SECRETO);
    await usuario.click(
      within(tabla).getByRole('button', { name: 'Detalle del caso' }),
    );
    expect(await screen.findByTestId('ruta')).toHaveTextContent(RUTA_DETALLE);
  });

  it('sin casos: «No hay casos en ruta académica»', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/ruta-academica': { estado: 200, cuerpo: [] },
    });
    renderizar('/jefe-departamento/ruta-academica');
    expect(
      await screen.findByText('No hay casos en ruta académica'),
    ).toBeInTheDocument();
  });
});

describe('Detalle del caso (CUD04)', () => {
  it('alerta: origen, nivel, justificación, nota, asistencia y antecedentes', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [DETALLE]: { estado: 200, cuerpo: DETALLE_ALERTA },
    });
    renderizar(RUTA_DETALLE);
    expect(
      await screen.findByText('Inasistencias en las últimas semanas.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Alerta académica temprana')).toBeInTheDocument();
    expect(screen.getByText('Alto')).toBeInTheDocument();
    const antecedentes = screen.getByRole('table');
    expect(
      within(antecedentes).getByRole('rowheader', { name: 'Física I' }),
    ).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(ID_ESTUDIANTE_SECRETO);
  });

  it('solicitud académica: motivo y disponibilidad solo si el backend los envía (D18)', async () => {
    const {
      motivo: _m,
      disponibilidad: _d,
      ...sinContenido
    } = CASO_SOLICITUD.origen;
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/con': {
        estado: 200,
        cuerpo: { caso: CASO_SOLICITUD, antecedentes: [] },
      },
      'GET /casos/sin': {
        estado: 200,
        cuerpo: {
          caso: { ...CASO_SOLICITUD, origen: sinContenido },
          antecedentes: [],
        },
      },
    });
    const { unmount } = renderizar('/jefe-departamento/casos/con');
    expect(
      await screen.findByText('Necesito apoyo en Cálculo.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Martes en la tarde')).toBeInTheDocument();
    unmount();
    renderizar('/jefe-departamento/casos/sin');
    expect(await screen.findByText('Académico')).toBeInTheDocument();
    expect(screen.queryByText('Motivo')).toBeNull();
    expect(screen.queryByText('Necesito apoyo en Cálculo.')).toBeNull();
  });
});

describe('Canalización del caso (CUD04)', () => {
  it('la ruta no tiene valor por defecto y «Canalizar caso» espera la elección (ajuste A)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [DETALLE]: { estado: 200, cuerpo: DETALLE_ALERTA },
    });
    renderizar(RUTA_DETALLE);
    const boton = await screen.findByRole('button', { name: 'Canalizar caso' });
    expect(boton).toBeDisabled();
    for (const opcion of screen.getAllByRole('radio')) {
      expect(opcion).not.toBeChecked();
    }
    await userEvent.setup().click(screen.getByLabelText('Ruta académica'));
    expect(boton).toBeEnabled();
  });

  it('psicología: «Caso remitido a psicología», sin plan y sin el motivo', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/caso-solicitud': {
        estado: 200,
        cuerpo: { caso: CASO_SOLICITUD, antecedentes: [] },
      },
      'POST /casos/caso-solicitud/canalizacion': {
        estado: 200,
        cuerpo: {
          mensaje: 'Caso remitido a psicología',
          caso: {
            ...CASO_SOLICITUD,
            ruta: 'PSICOLOGICA',
            estado: 'EN_EVALUACION',
            origen: { ...CASO_SOLICITUD.origen, motivo: undefined },
          },
        },
      },
    });
    renderizar('/jefe-departamento/casos/caso-solicitud');
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByLabelText('Ruta psicológica'));
    await usuario.click(screen.getByRole('button', { name: 'Canalizar caso' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Caso remitido a psicología',
    );
    expect(llamadas.at(-1)?.cuerpo).toEqual({ ruta: 'PSICOLOGICA' });
    expect(screen.queryByText('Necesito apoyo en Cálculo.')).toBeNull();
    expect(screen.queryByText('Plan de nivelación')).toBeNull();
  });

  it('académica: confirma y abre el plan de nivelación en la misma vista', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [DETALLE]: { estado: 200, cuerpo: DETALLE_ALERTA },
      [CANALIZAR]: {
        estado: 200,
        cuerpo: {
          mensaje: 'Caso canalizado a la ruta académica',
          caso: { ...CASO_ALERTA, ruta: 'ACADEMICA', estado: 'EN_NIVELACION' },
        },
      },
    });
    renderizar(RUTA_DETALLE);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByLabelText('Ruta académica'));
    await usuario.click(screen.getByRole('button', { name: 'Canalizar caso' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Caso canalizado a la ruta académica',
    );
    expect(
      screen.getByRole('heading', { name: 'Plan de nivelación' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Canalizar caso' })).toBeNull();
  });
});

describe('Canalización: conflictos y error de red (CUD04)', () => {
  it.each([
    'El caso ya fue canalizado',
    'El programa del estudiante no tiene Jefe de Departamento configurado.',
  ])('409: «%s»', async (mensaje) => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [DETALLE]: { estado: 200, cuerpo: DETALLE_ALERTA },
      [CANALIZAR]: { estado: 409, cuerpo: { message: mensaje } },
    });
    renderizar(RUTA_DETALLE);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByLabelText('Ruta académica'));
    await usuario.click(screen.getByRole('button', { name: 'Canalizar caso' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
  });

  it('error de red: la conciliación encuentra el caso ya canalizado y sigue al plan', async () => {
    let consultas = 0;
    simularApi({
      'GET /acceso/sesion': SESION,
      [DETALLE]: () => {
        consultas += 1;
        const caso =
          consultas === 1
            ? CASO_ALERTA
            : { ...CASO_ALERTA, ruta: 'ACADEMICA', estado: 'EN_NIVELACION' };
        return { estado: 200, cuerpo: { ...DETALLE_ALERTA, caso } };
      },
      [CANALIZAR]: 'red',
    });
    renderizar(RUTA_DETALLE);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByLabelText('Ruta académica'));
    await usuario.click(screen.getByRole('button', { name: 'Canalizar caso' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Caso canalizado a la ruta académica',
    );
    expect(screen.queryByText(TEXTO_ERROR_RED)).toBeNull();
  });

  it('error de red sin canalizar: el texto de error de red y se puede reintentar', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [DETALLE]: { estado: 200, cuerpo: DETALLE_ALERTA },
      [CANALIZAR]: 'red',
    });
    renderizar(RUTA_DETALLE);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByLabelText('Ruta académica'));
    const boton = screen.getByRole('button', { name: 'Canalizar caso' });
    await usuario.click(boton);
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_ERROR_RED);
    expect(boton).toBeEnabled();
  });
});
