import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CURSO } from './datos-docente';
import { renderizar, sesionDe, simularApi } from './utilidades';

/*
 * Pantallas del Docente con el diseño de F5b (D5; especificación §7.3):
 * ayuda con curso, código y periodo, tarjetas de sincronización y de
 * cantidad, tabla compacta, fila elegida y atenuadas, e insignias en las
 * alertas emitidas.
 */

const SESION = { estado: 200, cuerpo: sesionDe('DOCENTE') };

function abrirCurso(cuerpo: unknown) {
  simularApi({
    'GET /acceso/sesion': SESION,
    'GET /alertas/cursos/IS-101': { estado: 200, cuerpo },
  });
  renderizar('/docente/cursos/IS-101');
}

const fila = (nombre: string) =>
  screen.getByRole('rowheader', { name: nombre }).closest('tr')!;

describe('Listado del curso (D5, §7.3)', () => {
  it('ayuda «{curso} · Código {código} · Periodo {periodo}» bajo el título', async () => {
    abrirCurso(CURSO);
    expect(
      await screen.findByText(
        'Ingeniería de Software I · Código IS-101 · Periodo 2026-2',
      ),
    ).toBeInTheDocument();
  });

  it('tarjeta de sincronización con el ícono clock y la fecha en 24 h', async () => {
    abrirCurso(CURSO);
    const rotulo = await screen.findByText('Última sincronización');
    const tarjeta = rotulo.closest('div')!;
    expect(tarjeta).toHaveTextContent(
      'Última sincronización: 19/11/2026 03:00',
    );
    const icono = tarjeta.querySelector('svg')!;
    expect(icono).toHaveAttribute('aria-hidden', 'true');
    expect(icono.querySelector('path')).toHaveAttribute('d', 'M12 6v6l4 2');
  });

  it.each([
    [2, '2 estudiantes'],
    [1, '1 estudiante'],
    [0, '0 estudiantes'],
  ])('%i registros: «%s»', async (cantidad, texto) => {
    abrirCurso({ ...CURSO, registros: CURSO.registros.slice(0, cantidad) });
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });

  it('tabla compacta en su contenedor; «Emitir alerta» compacto, con su nombre y el ícono bell', async () => {
    abrirCurso(CURSO);
    const tabla = await screen.findByRole('table');
    expect(tabla).toHaveClass('tabla', 'compacta');
    expect(tabla.parentElement).toHaveClass('contenedor');
    const boton = within(fila('Ana Pérez')).getByRole('button', {
      name: 'Emitir alerta',
    });
    expect(boton).toHaveClass('boton-secundario', 'boton-compacto');
    expect(boton).toHaveAccessibleDescription('Ana Pérez');
    expect(boton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Listado del curso con el formulario abierto (D5, §7.3)', () => {
  it('con el formulario abierto: la fila elegida resaltada y las demás atenuadas; al cancelar, ninguna', async () => {
    abrirCurso(CURSO);
    await screen.findByRole('table');
    const usuario = userEvent.setup();
    await usuario.click(
      within(fila('Ana Pérez')).getByRole('button', { name: 'Emitir alerta' }),
    );
    expect(fila('Ana Pérez')).toHaveClass('seleccionada');
    expect(fila('Ana Pérez')).not.toHaveClass('atenuada');
    expect(fila('Luis Gómez')).toHaveClass('atenuada');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(fila('Ana Pérez')).not.toHaveClass('seleccionada');
    expect(fila('Luis Gómez')).not.toHaveClass('atenuada');
  });

  it('formulario en tarjeta destacada; contador «n / 2000» con su clase de alineación', async () => {
    abrirCurso(CURSO);
    await screen.findByRole('table');
    await userEvent.setup().click(
      within(fila('Ana Pérez')).getByRole('button', {
        name: 'Emitir alerta',
      }),
    );
    const region = screen.getByRole('region', { name: 'Emitir alerta' });
    expect(region).toHaveClass('tarjeta', 'destacada');
    // Debajo de la tabla, como en F2 (respuesta 1 de D5).
    expect(
      screen.getByRole('table').compareDocumentPosition(region) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(region).getByText('0 / 2000')).toHaveClass(
      'ayuda',
      'contador',
    );
  });

  it('«Emitir alerta» del formulario con el ícono send', async () => {
    abrirCurso(CURSO);
    await screen.findByRole('table');
    await userEvent.setup().click(
      within(fila('Ana Pérez')).getByRole('button', {
        name: 'Emitir alerta',
      }),
    );
    const region = screen.getByRole('region', { name: 'Emitir alerta' });
    const enviar = within(region).getByRole('button', {
      name: 'Emitir alerta',
    });
    const svg = enviar.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.querySelectorAll('path')[1]).toHaveAttribute(
      'd',
      'm21.854 2.147-10.94 10.939',
    );
  });
});

describe('Consulta de curso y alertas emitidas (D5)', () => {
  it('el formulario del código del curso va en tarjeta y en una fila', async () => {
    simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/docente');
    const campo = await screen.findByLabelText('Código del curso');
    const formulario = campo.closest('form')!;
    expect(formulario).toHaveClass('formulario', 'filtro');
    expect(formulario.parentElement).toHaveClass('tarjeta');
  });

  it('nivel con InsigniaRiesgo y estado con InsigniaEstado en una tabla compacta', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /alertas/emitidas?periodo=2026-2': {
        estado: 200,
        cuerpo: [
          {
            idAlerta: 'A1',
            fecha: '2026-11-19T15:00:00.000Z',
            curso: { idCurso: 'IS-101', nombre: 'Ingeniería de Software I' },
            estudiante: { id: 'e1', nombre: 'Ana Pérez' },
            nivelRiesgo: 'ALTO',
            descripcion: 'Inasistencias.',
            estadoAtencion: 'PENDIENTE',
          },
          {
            idAlerta: 'A2',
            fecha: '2026-11-19T15:00:00.000Z',
            curso: { idCurso: 'IS-101', nombre: 'Ingeniería de Software I' },
            estudiante: { id: 'e2', nombre: 'Luis Gómez' },
            nivelRiesgo: 'BAJO',
            descripcion: 'Bajó.',
            estadoAtencion: 'ATENDIDA',
          },
        ],
      },
    });
    renderizar('/docente/alertas');
    const usuario = userEvent.setup();
    await usuario.type(
      await screen.findByLabelText('Periodo académico'),
      '2026-2',
    );
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    const tabla = await screen.findByRole('table');
    expect(tabla).toHaveClass('compacta');
    const ana = within(fila('Ana Pérez'));
    expect(ana.getByText('Alto')).toHaveClass('insignia', 'riesgo-alto');
    expect(ana.getByText('Pendiente')).toHaveClass('insignia', 'estado-neutro');
    const luis = within(fila('Luis Gómez'));
    expect(luis.getByText('Bajo')).toHaveClass('insignia', 'riesgo-bajo');
    expect(luis.getByText('Atendida')).toHaveClass('insignia', 'estado-verde');
    expect(
      screen.getByLabelText('Periodo académico').closest('form'),
    ).toHaveClass('filtro');
  });
});
