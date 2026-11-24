import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CifraGrande } from './cifra-grande';

/* Cifra grande (especificación de diseño, §4): nota, asistencia y totales. */

describe('CifraGrande', () => {
  it('valor, rótulo y definición', () => {
    render(
      <CifraGrande
        valor="12"
        rotulo="Total de alertas"
        definicion="Alertas: definición."
      />,
    );
    expect(screen.getByText('12')).toHaveClass('valor');
    expect(screen.getByText('Total de alertas')).toHaveClass('rotulo');
    expect(screen.getByText('Alertas: definición.')).toHaveClass('definicion');
  });

  it('sin definición no pinta su línea', () => {
    const { container } = render(<CifraGrande valor="3,45" rotulo="Nota" />);
    expect(container.querySelector('.definicion')).toBeNull();
  });
});
