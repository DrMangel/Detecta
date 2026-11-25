import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParesDatos } from './pares-datos';

/*
 * Pares rótulo-valor con el rótulo encima (F5b-diseño: detalle del Jefe en
 * D6; expediente del Psicólogo en D7a). Los textos libres ocupan el ancho
 * completo y conservan sus saltos de línea.
 */
describe('ParesDatos', () => {
  it('cada par en su div con dt y dd; dos columnas por omisión', () => {
    render(
      <ParesDatos
        datos={[
          { rotulo: 'Estudiante', valor: 'Ana Pérez' },
          { rotulo: 'Motivo', valor: 'Línea 1\nLínea 2', ancho: true },
        ]}
      />,
    );
    const lista = screen.getByText('Estudiante').closest('dl')!;
    expect(lista).toHaveClass('pares', 'columnas-2');
    expect(screen.getByText('Estudiante').tagName).toBe('DT');
    expect(screen.getByText('Ana Pérez').tagName).toBe('DD');
    expect(screen.getByText('Ana Pérez').parentElement).not.toHaveClass(
      'ancho-completo',
    );
    const motivo = screen.getByText(/Línea 1/);
    expect(motivo.textContent).toBe('Línea 1\nLínea 2');
    expect(motivo.parentElement).toHaveClass('ancho-completo');
  });

  it('tres columnas si se piden', () => {
    render(
      <ParesDatos datos={[{ rotulo: 'Tutor', valor: 'Marta' }]} columnas={3} />,
    );
    expect(screen.getByText('Tutor').closest('dl')).toHaveClass('columnas-3');
  });

  it('admite rótulos repetidos sin perder ningún par', () => {
    render(
      <ParesDatos
        datos={[
          { rotulo: 'Consentimiento', valor: 'Sí' },
          { rotulo: 'Consentimiento', valor: 'No' },
        ]}
      />,
    );
    expect(screen.getAllByText('Consentimiento')).toHaveLength(2);
  });
});
