import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, SIN_SESION, sesionDe, simularApi } from './utilidades';

/*
 * Alertas emitidas por el Docente (CUD01 2.c; sd_CUD01
 * `consultarAlertasEmitidas(periodo)`): periodo vacío con la ayuda
 * «Por ejemplo: 2026-2» (respuesta 4), estado «Pendiente» o «Atendida»
 * (D27) y nunca contenido de solicitudes (D18, D19).
 */

const SESION = { estado: 200, cuerpo: sesionDe('DOCENTE') };
const EMITIDAS = 'GET /alertas/emitidas?periodo=2026-2';

const ALERTAS = [
  {
    idAlerta: 'A1',
    fecha: '2026-11-19T15:00:00.000Z',
    curso: { idCurso: 'IS-101', nombre: 'Ingeniería de Software I' },
    estudiante: { id: 'est-1', nombre: 'Ana Pérez' },
    nivelRiesgo: 'ALTO',
    descripcion: 'Inasistencias reiteradas.',
    estadoAtencion: 'PENDIENTE',
  },
  {
    idAlerta: 'A2',
    fecha: '2026-11-20T03:00:00.000Z',
    curso: { idCurso: 'CI-201', nombre: 'Cálculo Integral' },
    estudiante: { id: 'est-2', nombre: 'Luis Gómez' },
    nivelRiesgo: 'BAJO',
    descripcion: 'Bajó en el segundo parcial.',
    estadoAtencion: 'ATENDIDA',
    // Campos que el backend no envía: no deben aparecer nunca.
    motivo: 'MOTIVO CONFIDENCIAL',
    disponibilidad: 'DISPONIBILIDAD CONFIDENCIAL',
  },
];

async function consultar(periodo: string) {
  const usuario = userEvent.setup();
  const campo = await screen.findByLabelText('Periodo académico');
  if (periodo !== '') {
    await usuario.type(campo, periodo);
  }
  await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
}

describe('Alertas emitidas (CUD01 2.c)', () => {
  it('campo de periodo vacío, sin autocompletado, con la ayuda «Por ejemplo: 2026-2»', async () => {
    simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/docente/alertas');
    const campo = await screen.findByLabelText('Periodo académico');
    expect(campo).toHaveValue('');
    expect(campo).toHaveAttribute('maxLength', '20');
    expect(campo).toHaveAttribute('autocomplete', 'off');
    expect(campo).toHaveAccessibleDescription('Por ejemplo: 2026-2');
  });

  it('lista con fecha, estudiante, curso, nivel, justificación y estado «Pendiente» o «Atendida»; sin contenido de solicitudes', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [EMITIDAS]: { estado: 200, cuerpo: ALERTAS },
    });
    renderizar('/docente/alertas');
    await consultar('2026-2');
    const tabla = await screen.findByRole('table');
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual([
      'Fecha',
      'Estudiante',
      'Curso',
      'Nivel de riesgo',
      'Justificación',
      'Estado de atención',
    ]);
    const ana = within(
      within(tabla)
        .getByRole('rowheader', { name: 'Ana Pérez' })
        .closest('tr')!,
    );
    expect(ana.getByText('19/11/2026')).toBeInTheDocument();
    expect(ana.getByText('Ingeniería de Software I')).toBeInTheDocument();
    expect(ana.getByText('Alto')).toBeInTheDocument();
    expect(ana.getByText('Inasistencias reiteradas.')).toBeInTheDocument();
    expect(ana.getByText('Pendiente')).toBeInTheDocument();
    const luis = within(
      within(tabla)
        .getByRole('rowheader', { name: 'Luis Gómez' })
        .closest('tr')!,
    );
    // 03:00 UTC del 20 es el 19 en Bogotá.
    expect(luis.getByText('19/11/2026')).toBeInTheDocument();
    expect(luis.getByText('Atendida')).toBeInTheDocument();

    const html = document.body.innerHTML;
    expect(html).not.toContain('CONFIDENCIAL');
    expect(html).not.toContain('est-1');
  });

  it('sin alertas: «No ha emitido alertas en este periodo.»', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [EMITIDAS]: { estado: 200, cuerpo: [] },
    });
    renderizar('/docente/alertas');
    await consultar('2026-2');
    expect(
      await screen.findByText('No ha emitido alertas en este periodo.'),
    ).toBeInTheDocument();
  });

  it('periodo vacío: «Indique el periodo académico.» junto al campo y sin consultar', async () => {
    const { llamadas } = simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/docente/alertas');
    await consultar('');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Indique el periodo académico.',
    );
    expect(llamadas.some((l) => l.url.includes('/alertas/'))).toBe(false);
  });

  it('400 del backend: el texto tal cual', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [EMITIDAS]: {
        estado: 400,
        cuerpo: { message: 'El texto excede la longitud permitida.' },
      },
    });
    renderizar('/docente/alertas');
    await consultar('2026-2');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El texto excede la longitud permitida.',
    );
  });

  it('503: «Error al consultar la información»', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [EMITIDAS]: {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
    });
    renderizar('/docente/alertas');
    await consultar('2026-2');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error al consultar la información',
    );
  });

  it('401: al inicio de sesión con el aviso', async () => {
    simularApi({ 'GET /acceso/sesion': SESION, [EMITIDAS]: SIN_SESION });
    renderizar('/docente/alertas');
    await consultar('2026-2');
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion'),
    );
  });
});
