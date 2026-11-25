import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LineaEstado } from './linea-estado';

/* Línea de estado del caso (especificación de diseño, §4 y 7.4). */

const PASOS = [
  { rotulo: 'Caso recibido', estado: 'hecho' },
  { rotulo: 'Canalización', estado: 'actual' },
  { rotulo: 'Plan de nivelación', estado: 'pendiente' },
] as const;

describe('LineaEstado', () => {
  it('una lista ordenada con un paso por elemento y su texto visible', () => {
    render(<LineaEstado pasos={PASOS} />);
    const lista = screen.getByRole('list');
    expect(lista.tagName).toBe('OL');
    const pasos = within(lista).getAllByRole('listitem');
    expect(pasos.map((p) => p.textContent)).toEqual([
      'Caso recibido, completado',
      'Canalización',
      'Plan de nivelación, pendiente',
    ]);
  });

  it('el estado de los pasos hecho y pendiente se anuncia con texto oculto', () => {
    render(<LineaEstado pasos={PASOS} />);
    const [hecho, actual, pendiente] = screen.getAllByRole('listitem');
    expect(within(hecho!).getByText(', completado')).toHaveClass('oculto');
    expect(within(pendiente!).getByText(', pendiente')).toHaveClass('oculto');
    expect(actual!.querySelector('.oculto')).toBeNull();
  });

  it('solo el paso actual lleva aria-current="step"', () => {
    render(<LineaEstado pasos={PASOS} />);
    const [hecho, actual, pendiente] = screen.getAllByRole('listitem');
    expect(actual).toHaveAttribute('aria-current', 'step');
    expect(hecho).not.toHaveAttribute('aria-current');
    expect(pendiente).not.toHaveAttribute('aria-current');
  });

  it('el paso hecho lleva el ícono check; los demás, ninguno', () => {
    render(<LineaEstado pasos={PASOS} />);
    const [hecho, actual, pendiente] = screen.getAllByRole('listitem');
    expect(hecho!.querySelector('svg path')).toHaveAttribute(
      'd',
      'M20 6 9 17l-5-5',
    );
    expect(hecho!.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(actual!.querySelector('svg')).toBeNull();
    expect(pendiente!.querySelector('svg')).toBeNull();
  });

  it('cada paso marca su estado con una clase', () => {
    render(<LineaEstado pasos={PASOS} />);
    const [hecho, actual, pendiente] = screen.getAllByRole('listitem');
    expect(hecho).toHaveClass('hecho');
    expect(actual).toHaveClass('actual');
    expect(pendiente).toHaveClass('pendiente');
  });
});
