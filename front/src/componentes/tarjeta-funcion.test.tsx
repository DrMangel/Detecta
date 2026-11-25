import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TarjetaFuncion } from './tarjeta-funcion';

/* Tarjeta de función del inicio (especificación de diseño, §7.0). */

function pintar(extra: Partial<ComponentProps<typeof TarjetaFuncion>> = {}) {
  return render(
    <MemoryRouter>
      <TarjetaFuncion
        ruta="/estudiante"
        titulo="Consulta académica"
        descripcion="Revisa tus notas."
        icono="book-open"
        {...extra}
      />
    </MemoryRouter>,
  );
}

describe('TarjetaFuncion', () => {
  it('toda la tarjeta es un enlace a la ruta, nombrado por su título', () => {
    pintar();
    const enlace = screen.getByRole('link', { name: /Consulta académica/ });
    expect(enlace).toHaveAttribute('href', '/estudiante');
    expect(enlace).toHaveTextContent('Revisa tus notas.');
  });

  it('ícono de la función y chevron-right decorativos', () => {
    pintar();
    const iconos = screen.getByRole('link').querySelectorAll('svg');
    expect(iconos).toHaveLength(2);
    for (const icono of iconos) {
      expect(icono).toHaveAttribute('aria-hidden', 'true');
    }
    expect(iconos[1]!.querySelector('path')).toHaveAttribute(
      'd',
      'm9 18 6-6-6-6',
    );
  });

  it('insignia opcional y variante destacada', () => {
    pintar({ insignia: <span>Confidencial</span>, destacada: true });
    const enlace = screen.getByRole('link');
    expect(enlace).toHaveTextContent('Confidencial');
    expect(enlace).toHaveClass('tarjeta', 'destacada');
  });

  it('sin insignia ni variante', () => {
    pintar();
    expect(screen.getByRole('link')).not.toHaveClass('destacada');
  });
});
