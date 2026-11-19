import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TEXTO_SIN_PERMISO } from '../servicios-api/errores';
import { CURSO, ID_ESTUDIANTE_SECRETO } from './datos-docente';
import { renderizar, SIN_SESION, sesionDe, simularApi } from './utilidades';

/*
 * Criterio de cierre de F2, «el docente ve solo sus cursos; la fecha de la
 * última sincronización y la marca de información no disponible son
 * inequívocas» (CUD01, rama Docente; sd_CUD01 `consultarCurso`; ER 3.3.1 y
 * 3.3.5; respuestas 1 a 3 y ajustes B y C de F2).
 */

const SESION = { estado: 200, cuerpo: sesionDe('DOCENTE') };
describe('Consulta de curso (CUD01, Docente)', () => {
  it('sin código no se consulta; el campo admite 36 caracteres y no autocompleta', async () => {
    const { llamadas } = simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/docente');
    const campo = await screen.findByLabelText('Código del curso');
    expect(campo).toHaveAttribute('maxLength', '36');
    expect(campo).toHaveAttribute('autocomplete', 'off');
    const boton = screen.getByRole('button', { name: 'Consultar' });
    expect(boton).toBeDisabled();
    await userEvent.setup().type(campo, '   ');
    expect(boton).toBeDisabled();
    expect(llamadas.some((l) => l.url.includes('/alertas/'))).toBe(false);
  });

  it('el código lleva al listado del curso y viaja codificado en la URL', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS%2F101%20A': { estado: 200, cuerpo: CURSO },
    });
    renderizar('/docente');
    const usuario = userEvent.setup();
    await usuario.type(
      await screen.findByLabelText('Código del curso'),
      'IS/101 A',
    );
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(llamadas.map((l) => l.url)).toContain(
      '/api/alertas/cursos/IS%2F101%20A',
    );
  });

  it('listado: curso, periodo, fecha y hora de la última sincronización (Bogotá, 24 h) y tabla semántica', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': { estado: 200, cuerpo: CURSO },
    });
    renderizar('/docente/cursos/IS-101');
    const tabla = await screen.findByRole('table');

    // 08:00 UTC = 03:00 en Bogotá. Sin texto que afirme o niegue que está
    // actualizada (respuesta 3).
    expect(screen.getByText('19/11/2026 03:00')).toBeInTheDocument();
    expect(screen.getByText('2026-2')).toBeInTheDocument();
    expect(screen.queryByText(/actualizad/i)).toBeNull();

    const columnas = within(tabla).getAllByRole('columnheader');
    expect(columnas.map((c) => c.textContent)).toEqual([
      'Estudiante',
      'Nota',
      'Asistencia',
      'Emitir alerta',
    ]);
    columnas.forEach((c) => expect(c).toHaveAttribute('scope', 'col'));
    const ana = within(tabla).getByRole('rowheader', { name: 'Ana Pérez' });
    expect(ana).toHaveAttribute('scope', 'row');
    const fila = within(ana.closest('tr')!);
    expect(fila.getByText('1,87')).toBeInTheDocument();
    expect(fila.getByText('53,00 %')).toBeInTheDocument();
    expect(
      fila.getByRole('button', { name: 'Emitir alerta' }),
    ).toHaveAccessibleDescription('Ana Pérez');
  });

  it('el id del estudiante no se muestra ni queda en el DOM (ajuste C)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': { estado: 200, cuerpo: CURSO },
    });
    const { container } = renderizar('/docente/cursos/IS-101');
    await screen.findByRole('table');
    await userEvent
      .setup()
      .click(screen.getAllByRole('button', { name: 'Emitir alerta' })[0]!);
    await screen.findByRole('heading', { name: 'Emitir alerta' });
    expect(document.body.innerHTML).not.toContain(ID_ESTUDIANTE_SECRETO);
    expect(container.innerHTML).not.toContain('est-otro');
    // Tampoco ningún otro identificador de la base (ids del DOM por posición).
    expect(document.body.innerHTML).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
  });

  it('curso nunca sincronizado: «Información no disponible» en lugar de la fecha', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': {
        estado: 200,
        cuerpo: {
          ...CURSO,
          curso: { ...CURSO.curso, ultimaSincronizacion: null },
        },
      },
    });
    renderizar('/docente/cursos/IS-101');
    const fecha = await screen.findByText('Última sincronización');
    expect(fecha.nextElementSibling).toHaveTextContent(
      'Información no disponible',
    );
  });

  it('curso sin registros (4.a): el mensaje del backend y sin tabla', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': {
        estado: 200,
        cuerpo: {
          curso: CURSO.curso,
          registros: [],
          mensaje: 'Información no disponible',
        },
      },
    });
    renderizar('/docente/cursos/IS-101');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Información no disponible',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('403 de curso ajeno: el texto de sd_CUD01 «El curso no está asignado al docente» (respuesta 2)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/OTRO': {
        estado: 403,
        cuerpo: {
          message: 'El curso no está asignado al docente',
          error: 'Forbidden',
          statusCode: 403,
        },
      },
    });
    renderizar('/docente/cursos/OTRO');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El curso no está asignado al docente',
    );
  });

  it('otro 403 (ForbiddenException sin texto): el texto de F0', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': {
        estado: 403,
        cuerpo: { message: 'Forbidden', statusCode: 403 },
      },
    });
    renderizar('/docente/cursos/IS-101');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      TEXTO_SIN_PERMISO,
    );
  });

  it('503: «Error al consultar la información»', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
    });
    renderizar('/docente/cursos/IS-101');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error al consultar la información',
    );
  });

  it('401 en la consulta del curso: al inicio de sesión con el aviso', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': SIN_SESION,
    });
    renderizar('/docente/cursos/IS-101');
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
  });
});

describe('Navegación del Docente', () => {
  it('dos enlaces; «Consulta de curso» queda activa en el listado de un curso y no en «Alertas emitidas»', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': { estado: 200, cuerpo: CURSO },
    });
    renderizar('/docente/cursos/IS-101');
    const navegacion = await screen.findByRole('navigation');
    const [consulta, alertas] = within(navegacion).getAllByRole('link');
    expect([consulta?.textContent, alertas?.textContent]).toEqual([
      'Consulta de curso',
      'Alertas emitidas',
    ]);
    expect(consulta).toHaveAttribute('aria-current', 'page');
    expect(alertas).not.toHaveAttribute('aria-current');

    await userEvent.setup().click(alertas!);
    expect(screen.getByTestId('ruta')).toHaveTextContent('/docente/alertas');
    // La página nueva monta su propia navegación.
    const [consulta2, alertas2] = within(
      await screen.findByRole('navigation'),
    ).getAllByRole('link');
    expect(alertas2).toHaveAttribute('aria-current', 'page');
    expect(consulta2).not.toHaveAttribute('aria-current');
  });

  it('nada se guarda en localStorage ni en sessionStorage', async () => {
    const escribir = vi.spyOn(Storage.prototype, 'setItem');
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/cursos/IS-101': { estado: 200, cuerpo: CURSO },
    });
    renderizar('/docente/cursos/IS-101');
    await screen.findByRole('table');
    expect(escribir).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });
});
