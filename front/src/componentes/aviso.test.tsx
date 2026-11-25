import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Aviso } from './aviso';

/*
 * Aviso estático con ícono (F5b-diseño, D7a): el de confidencialidad del
 * Estudiante y el del consentimiento del Psicólogo. No es un mensaje en
 * vivo: quien lo necesite pone su propia región aria-live alrededor.
 */
describe('Aviso', () => {
  it('pinta el ícono decorativo y el contenido, sin rol de estado', () => {
    render(
      <Aviso icono="lock">
        <p>Texto del aviso</p>
      </Aviso>,
    );
    const texto = screen.getByText('Texto del aviso');
    const aviso = texto.closest('[class~="aviso"]')!;
    expect(aviso).not.toBeNull();
    expect(aviso).not.toHaveAttribute('role');
    expect(aviso).not.toHaveAttribute('aria-live');
    const icono = aviso.querySelector('svg')!;
    expect(icono).toHaveAttribute('aria-hidden', 'true');
    expect(icono.querySelector('path')).toHaveAttribute(
      'd',
      'M7 11V7a5 5 0 0 1 10 0v4',
    );
    expect(texto.parentElement).toHaveClass('texto');
  });
});
