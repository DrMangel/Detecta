import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EnlaceVolver } from './enlace-volver';

/* Enlace de regreso (especificación de diseño, §7.4 y 7.5): solo navega. */

describe('EnlaceVolver', () => {
  it('enlace con su texto, su destino y el ícono arrow-left decorativo', () => {
    render(
      <MemoryRouter>
        <EnlaceVolver a="/psicologo">Remisiones</EnlaceVolver>
      </MemoryRouter>,
    );
    const enlace = screen.getByRole('link', { name: 'Remisiones' });
    expect(enlace).toHaveAttribute('href', '/psicologo');
    expect(enlace).toHaveClass('volver');
    const icono = enlace.querySelector('svg')!;
    expect(icono).toHaveAttribute('aria-hidden', 'true');
    expect(icono.querySelector('path')).toHaveAttribute('d', 'm12 19-7-7 7-7');
  });
});
