import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INFORME } from './datos-jefe';
import {
  renderizar,
  sesionDe,
  simularApi,
  type RespuestaSimulada,
} from './utilidades';

const ID_PROGRAMA_A = 'ID-PROGRAMA-SECRETO-A';
const ID_PROGRAMA_B = 'ID-PROGRAMA-SECRETO-B';
const PROGRAMAS = [
  { idPrograma: ID_PROGRAMA_A, nombre: 'Ingeniería' },
  { idPrograma: ID_PROGRAMA_B, nombre: 'Psicología' },
];
const SESION = { estado: 200, cuerpo: sesionDe('PSICOLOGO') };

function api(extra: Record<string, RespuestaSimulada>) {
  return simularApi({
    'GET /acceso/sesion': SESION,
    'GET /programas': { estado: 200, cuerpo: PROGRAMAS },
    ...extra,
  });
}

async function completarFiltros() {
  const usuario = userEvent.setup();
  await usuario.type(
    await screen.findByLabelText('Periodo académico'),
    '2026-2',
  );
  await usuario.type(screen.getByLabelText('Código del curso'), 'MAT-201');
  return usuario;
}

describe('Informes de riesgo (CUD10, Psicólogo)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('lista solo nombres, usa posiciones como value y no expone identificadores ni almacenamiento', async () => {
    api({});
    const { container } = renderizar('/psicologo/informes');

    const selector = await screen.findByLabelText('Programa');
    await screen.findByRole('option', { name: 'Ingeniería' });
    expect(selector).toHaveValue('');
    expect(
      screen.getByRole('option', { name: 'Seleccione un programa' }),
    ).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Ingeniería' })).toHaveValue('0');
    expect(screen.getByRole('option', { name: 'Psicología' })).toHaveValue('1');
    expect(container.innerHTML).not.toContain(ID_PROGRAMA_A);
    expect(container.innerHTML).not.toContain(ID_PROGRAMA_B);
    for (const elemento of container.querySelectorAll('*')) {
      for (const atributo of elemento.attributes) {
        expect(atributo.value).not.toContain(ID_PROGRAMA_A);
        expect(atributo.value).not.toContain(ID_PROGRAMA_B);
      }
    }
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('sin programa seleccionado no envía el informe', async () => {
    const { llamadas } = api({});
    renderizar('/psicologo/informes');
    const usuario = await completarFiltros();

    const boton = screen.getByRole('button', { name: 'Generar informe' });
    expect(boton).toBeDisabled();
    await usuario.click(boton);
    expect(llamadas.some((llamada) => llamada.url === '/api/informes')).toBe(
      false,
    );
  });

  it('envía idPrograma resuelto desde la posición seleccionada y presenta 200 sin datos', async () => {
    const { llamadas } = api({
      'POST /informes': {
        estado: 200,
        cuerpo: { mensaje: 'No hay datos para el periodo seleccionado' },
      },
    });
    renderizar('/psicologo/informes');
    const usuario = await completarFiltros();
    await usuario.selectOptions(await screen.findByLabelText('Programa'), '1');
    await usuario.click(
      screen.getByRole('button', { name: 'Generar informe' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No hay datos para el periodo seleccionado',
    );
    expect(
      llamadas.find((llamada) => llamada.url === '/api/informes')?.cuerpo,
    ).toEqual({
      periodo: '2026-2',
      idPrograma: ID_PROGRAMA_B,
      idCurso: 'MAT-201',
    });
  });

  it('curso existente fuera del programa seleccionado: conserva el mensaje de no hay datos del backend', async () => {
    const { llamadas } = api({
      'POST /informes': {
        estado: 200,
        cuerpo: { mensaje: 'No hay datos para el periodo seleccionado' },
      },
    });
    renderizar('/psicologo/informes');
    const usuario = await completarFiltros();
    await usuario.selectOptions(await screen.findByLabelText('Programa'), '0');
    await usuario.click(
      screen.getByRole('button', { name: 'Generar informe' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No hay datos para el periodo seleccionado',
    );
    expect(
      llamadas.find((llamada) => llamada.url === '/api/informes')?.cuerpo,
    ).toEqual({
      periodo: '2026-2',
      idPrograma: ID_PROGRAMA_A,
      idCurso: 'MAT-201',
    });
  });

  it('lista vacía: muestra el texto provisional y mantiene la generación bloqueada', async () => {
    api({ 'GET /programas': { estado: 200, cuerpo: [] } });
    renderizar('/psicologo/informes');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No hay programas disponibles.',
    );
    expect(
      screen.getByRole('button', { name: 'Generar informe' }),
    ).toBeDisabled();
  });

  it.each([
    [
      503,
      { message: 'Error al consultar la información' },
      'Error al consultar la información',
    ],
    [
      403,
      { message: 'Forbidden' },
      'No tiene permiso para realizar esta acción.',
    ],
    [
      429,
      { message: 'Demasiadas consultas. Intente de nuevo más tarde.' },
      'Demasiadas consultas. Intente de nuevo más tarde.',
    ],
  ])(
    '%i al cargar programas muestra el mensaje uniforme',
    async (estado, cuerpo, texto) => {
      api({ 'GET /programas': { estado, cuerpo } });
      renderizar('/psicologo/informes');
      expect(await screen.findByRole('alert')).toHaveTextContent(texto);
    },
  );

  it('401 al cargar programas invalida la sesión y vuelve al inicio de sesión', async () => {
    api({
      'GET /programas': {
        estado: 401,
        cuerpo: { message: 'Sesión no válida o caducada' },
      },
    });
    renderizar('/psicologo/informes');

    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
  });

  it('descarga el PDF del informe mediante la API compartida', async () => {
    const { llamadas } = api({
      'POST /informes': { estado: 201, cuerpo: { informe: INFORME } },
      'GET /informes/inf-1/pdf': { estado: 200, cuerpo: 'pdf' },
    });
    const crear = vi.fn(() => 'blob:informe-psicologo');
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
    renderizar('/psicologo/informes');
    const usuario = await completarFiltros();
    await usuario.selectOptions(await screen.findByLabelText('Programa'), '1');
    await usuario.click(
      screen.getByRole('button', { name: 'Generar informe' }),
    );
    await usuario.click(
      await screen.findByRole('button', { name: 'Exportar PDF' }),
    );

    await waitFor(() =>
      expect(nombres).toEqual(['informe-riesgo-2026-2-MAT-201.pdf']),
    );
    expect(llamadas.at(-1)?.url).toBe('/api/informes/inf-1/pdf');
    expect(liberar).toHaveBeenCalledWith('blob:informe-psicologo');
  });
});
