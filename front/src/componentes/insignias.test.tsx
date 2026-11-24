import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsigniaEstado, InsigniaRiesgo } from './insignias';

/*
 * Insignias (especificación de diseño, §4): el riesgo nunca depende solo del
 * color (regla 8): siempre ícono y texto.
 */

const trazo = (insignia: HTMLElement) =>
  insignia.querySelector('svg path')?.getAttribute('d');

describe('InsigniaRiesgo', () => {
  it.each([
    ['BAJO', 'Bajo', 'riesgo-bajo'],
    ['MEDIO', 'Medio', 'riesgo-medio'],
    ['ALTO', 'Alto', 'riesgo-alto'],
  ] as const)(
    '%s: texto «%s», clase %s e ícono decorativo',
    (nivel, texto, clase) => {
      render(<InsigniaRiesgo nivel={nivel} />);
      const insignia = screen.getByText(texto);
      expect(insignia).toHaveClass('insignia', clase);
      expect(insignia.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    },
  );

  it('cada nivel tiene su propio ícono (check, triangle-alert, octagon-alert)', () => {
    const { rerender } = render(<InsigniaRiesgo nivel="BAJO" />);
    const bajo = trazo(screen.getByText('Bajo'));
    rerender(<InsigniaRiesgo nivel="MEDIO" />);
    const medio = trazo(screen.getByText('Medio'));
    rerender(<InsigniaRiesgo nivel="ALTO" />);
    const alto = trazo(screen.getByText('Alto'));
    expect(bajo).toBe('M20 6 9 17l-5-5');
    expect(new Set([bajo, medio, alto]).size).toBe(3);
  });
});

describe('InsigniaEstado', () => {
  it.each(['neutro', 'azul', 'verde'] as const)(
    'tono %s: el texto siempre visible',
    (tono) => {
      render(<InsigniaEstado texto="En evaluación" tono={tono} />);
      expect(screen.getByText('En evaluación')).toHaveClass(
        'insignia',
        `estado-${tono}`,
      );
    },
  );
});
