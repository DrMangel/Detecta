import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INFORME } from './datos-jefe';
import {
  renderizar,
  sesionDe,
  simularApi,
  type RespuestaSimulada,
} from './utilidades';

/*
 * Criterio de cierre de F3, «el informe se genera y se exporta en PDF»
 * (CUD10; sd_CUD10, rama del Jefe; respuesta 2 y ajustes C y E de F3).
 */

const SESION = { estado: 200, cuerpo: sesionDe('JEFE_DEPARTAMENTO') };

async function generar(periodo: string, curso: string) {
  const usuario = userEvent.setup();
  if (periodo !== '') {
    await usuario.type(
      await screen.findByLabelText('Periodo académico'),
      periodo,
    );
  }
  await usuario.type(await screen.findByLabelText('Código del curso'), curso);
  await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));
  return usuario;
}

describe('Informes de riesgo (CUD10, Jefe)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin código del curso no se genera; sin periodo, «Indique el periodo académico.»', async () => {
    const { llamadas } = simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/jefe-departamento/informes');
    const boton = await screen.findByRole('button', {
      name: 'Generar informe',
    });
    expect(boton).toBeDisabled();
    expect(screen.getByLabelText('Código del curso')).toHaveAttribute(
      'maxLength',
      '36',
    );
    await generar('', 'MAT-201');
    expect(
      await screen.findByText('Indique el periodo académico.'),
    ).toBeInTheDocument();
    expect(llamadas.some((l) => l.url === '/api/informes')).toBe(false);
  });

  it('200 sin informe: «No hay datos para el periodo seleccionado»; el Jefe no envía programa', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      'POST /informes': {
        estado: 200,
        cuerpo: { mensaje: 'No hay datos para el periodo seleccionado' },
      },
    });
    renderizar('/jefe-departamento/informes');
    await generar('2026-2', 'MAT-201');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No hay datos para el periodo seleccionado',
    );
    expect(llamadas.at(-1)?.cuerpo).toEqual({
      periodo: '2026-2',
      idCurso: 'MAT-201',
    });
  });

  it('estado de carga y botón deshabilitado mientras se genera (ajuste E)', async () => {
    let responder: (r: RespuestaSimulada) => void = () => undefined;
    simularApi({
      'GET /acceso/sesion': SESION,
      'POST /informes': () =>
        new Promise<RespuestaSimulada>((resolver) => {
          responder = resolver;
        }),
    });
    renderizar('/jefe-departamento/informes');
    await generar('2026-2', 'MAT-201');
    expect(
      await screen.findByText('Generando el informe…'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Generar informe' }),
    ).toBeDisabled();
    responder({ estado: 201, cuerpo: { informe: INFORME } });
    expect(await screen.findByText('Cálculo Integral')).toBeInTheDocument();
    expect(screen.queryByText('Generando el informe…')).toBeNull();
  });

  it('201: totales con sus definiciones y el resumen', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'POST /informes': { estado: 201, cuerpo: { informe: INFORME } },
    });
    renderizar('/jefe-departamento/informes');
    await generar('2026-2', 'MAT-201');
    expect(await screen.findByText('Total de alertas')).toBeInTheDocument();
    expect(screen.getByText('Total de casos')).toBeInTheDocument();
    expect(screen.getByText('Total de planes')).toBeInTheDocument();
    expect(screen.getByText('Alertas: definición.')).toBeInTheDocument();
    expect(screen.getByText('Resumen del periodo.')).toBeInTheDocument();
  });

  it('«Exportar PDF» descarga con un nombre derivado del periodo y el curso', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      'POST /informes': { estado: 201, cuerpo: { informe: INFORME } },
      'GET /informes/inf-1/pdf': { estado: 200, cuerpo: 'pdf' },
    });
    const crear = vi.fn(() => 'blob:informe');
    const liberar = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: crear,
      revokeObjectURL: liberar,
    });
    const nombres: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      nombres.push(this.download);
    });
    renderizar('/jefe-departamento/informes');
    const usuario = await generar('2026-2', 'MAT-201');
    await usuario.click(
      await screen.findByRole('button', { name: 'Exportar PDF' }),
    );
    await vi.waitFor(() =>
      expect(nombres).toEqual(['informe-riesgo-2026-2-MAT-201.pdf']),
    );
    expect(liberar).toHaveBeenCalledWith('blob:informe');
    expect(llamadas.at(-1)?.url).toBe('/api/informes/inf-1/pdf');
    vi.unstubAllGlobals();
  });

  it('error al generar: el texto del backend', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'POST /informes': {
        estado: 503,
        cuerpo: { message: 'Error al generar el informe' },
      },
    });
    renderizar('/jefe-departamento/informes');
    await generar('2026-2', 'MAT-201');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error al generar el informe',
    );
  });
});
