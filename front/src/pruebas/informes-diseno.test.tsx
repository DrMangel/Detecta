import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { INFORME } from './datos-jefe';
import { renderizar, sesionDe, simularApi } from './utilidades';

/*
 * Informes de riesgo con el diseño de F5b (D7b; especificación §7.7;
 * maquetas 12 y 13), compartidos por el Jefe y el Psicólogo: ayuda,
 * filtros en tarjeta con la misma estructura por campo, cifras grandes con
 * su definición, aviso con lock y «Exportar PDF» secundario con download.
 */

const AYUDA = 'Totales por asignatura y periodo, sin datos personales.';
const AVISO =
  'Este informe solo contiene datos agregados: no incluye nombres, motivos ni contenido de los expedientes.';
const PROGRAMAS = [{ idPrograma: 'prog-1', nombre: 'Ingeniería' }];

function abrirJefe() {
  simularApi({
    'GET /acceso/sesion': {
      estado: 200,
      cuerpo: sesionDe('JEFE_DEPARTAMENTO'),
    },
    'POST /informes': { estado: 201, cuerpo: { informe: INFORME } },
  });
  renderizar('/jefe-departamento/informes');
}

function abrirPsicologo() {
  simularApi({
    'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('PSICOLOGO') },
    'GET /programas': { estado: 200, cuerpo: PROGRAMAS },
    'POST /informes': { estado: 201, cuerpo: { informe: INFORME } },
  });
  renderizar('/psicologo/informes');
}

async function generar(conPrograma: boolean) {
  const usuario = userEvent.setup();
  await usuario.type(
    await screen.findByLabelText('Periodo académico'),
    '2026-2',
  );
  if (conPrograma) {
    await screen.findByRole('option', { name: 'Ingeniería' });
    await usuario.selectOptions(screen.getByLabelText('Programa'), '0');
  }
  await usuario.type(screen.getByLabelText('Código del curso'), 'MAT-201');
  await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));
  return (await screen.findByText('Total de alertas')).closest('section')!;
}

const campo = (rotulo: string) =>
  screen.getByLabelText(rotulo).closest('[class~="campo"]')!;

describe('Filtros de Informes (D7b, §7.7)', () => {
  it('Jefe: ayuda, filtros en tarjeta y cada campo con la línea de ayuda fija; sin «Programa»', async () => {
    abrirJefe();
    await screen.findByLabelText('Periodo académico');
    expect(screen.getByText(AYUDA)).toBeInTheDocument();
    const formulario = screen
      .getByLabelText('Periodo académico')
      .closest('form')!;
    expect(formulario).toHaveClass('filtros');
    expect(formulario.closest('[class~="tarjeta"]')).not.toBeNull();
    expect(campo('Periodo académico')).toHaveClass('campo-filtro');
    expect(campo('Código del curso')).toHaveClass('campo-filtro');
    expect(screen.queryByLabelText('Programa')).toBeNull();
  });

  it('Psicólogo: la misma ayuda y «Programa» con la misma estructura', async () => {
    abrirPsicologo();
    await screen.findByLabelText('Programa');
    expect(screen.getByText(AYUDA)).toBeInTheDocument();
    expect(campo('Periodo académico')).toHaveClass('campo-filtro');
    expect(campo('Programa')).toHaveClass('campo-filtro');
    expect(campo('Código del curso')).toHaveClass('campo-filtro');
    expect(screen.getByLabelText('Programa').closest('form')).toHaveClass(
      'filtros',
    );
  });
});

describe('Informe generado (D7b, §7.7)', () => {
  it.each([
    ['Jefe', abrirJefe, false],
    ['Psicólogo', abrirPsicologo, true],
  ])(
    '%s: tarjeta con curso, periodo y fecha, tres cifras grandes, resumen, aviso y «Exportar PDF»',
    async (_, abrir, conPrograma) => {
      abrir();
      const informe = await generar(conPrograma);
      expect(informe).toHaveClass('tarjeta');

      const pares = within(informe).getByText('Curso').closest('dl')!;
      expect(pares).toHaveClass('pares', 'columnas-3');
      expect(within(pares).getByText('Cálculo Integral')).toBeInTheDocument();
      expect(within(pares).getByText('2026-2')).toBeInTheDocument();

      const cifras: [string, string, string][] = [
        ['Total de alertas', '4', 'Alertas: definición.'],
        ['Total de casos', '1', 'Casos: definición.'],
        ['Total de planes', '2', 'Planes de nivelación: definición.'],
      ];
      cifras.forEach(([rotulo, valor, definicion]) => {
        const cifra = within(informe)
          .getByText(rotulo)
          .closest('[class~="cifra"]')!;
        expect(within(cifra as HTMLElement).getByText(valor)).toHaveClass(
          'valor',
        );
        expect(within(cifra as HTMLElement).getByText(definicion)).toHaveClass(
          'definicion',
        );
      });

      expect(within(informe).getByText('Resumen del periodo.')).toHaveClass(
        'resumen',
      );
      const aviso = within(informe)
        .getByText(AVISO)
        .closest('[class~="aviso"]')!;
      expect(aviso.querySelector('svg path')).toHaveAttribute(
        'd',
        'M7 11V7a5 5 0 0 1 10 0v4',
      );
      const exportar = within(informe).getByRole('button', {
        name: 'Exportar PDF',
      });
      expect(exportar).toHaveClass('boton-secundario');
      expect(exportar.querySelector('svg path')).toHaveAttribute(
        'd',
        'M12 15V3',
      );
    },
  );
});
