import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icono, NOMBRES_ICONO } from './icono';

/* Íconos de trazo de la especificación de diseño (§3.4). */

describe('Icono', () => {
  it('es decorativo: oculto a los lectores de pantalla y sin foco', () => {
    const { container } = render(<Icono nombre="log-out" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('trazo de Lucide: 24×24, currentColor, grosor 2 y 20 px por defecto', () => {
    const { container } = render(<Icono nombre="log-out" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '2');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('acepta otro tamaño', () => {
    const { container } = render(<Icono nombre="log-out" tamano={14} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '14');
  });

  it('dibuja los trazos del ícono pedido', () => {
    const { container } = render(<Icono nombre="log-out" />);
    expect(
      [...container.querySelectorAll('path')].map((p) => p.getAttribute('d')),
    ).toEqual([
      'm16 17 5-5-5-5',
      'M21 12H9',
      'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
    ]);
  });

  it.each(NOMBRES_ICONO)('«%s» tiene al menos un trazo', (nombre) => {
    const { container } = render(<Icono nombre={nombre} />);
    expect(
      container.querySelectorAll('path, circle, rect').length,
    ).toBeGreaterThan(0);
  });
});
