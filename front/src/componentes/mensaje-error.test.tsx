import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MensajeError, MensajeInformativo } from './mensaje-error';

/*
 * Mensajes con ícono (especificación de diseño, §4): se conservan
 * role="alert" y role="status"; el ícono es decorativo.
 */

describe('MensajeError', () => {
  it('role="alert", su texto, su id y el ícono triangle-alert', () => {
    render(<MensajeError mensaje="Error al consultar" id="e1" />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Error al consultar');
    expect(alerta).toHaveAttribute('id', 'e1');
    expect(alerta).toHaveClass('error');
    const icono = alerta.querySelector('svg')!;
    expect(icono).toHaveAttribute('aria-hidden', 'true');
    expect(icono.querySelector('path')).toHaveAttribute(
      'd',
      'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
    );
  });

  it('sin mensaje no pinta nada', () => {
    const { container } = render(<MensajeError mensaje={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('MensajeInformativo', () => {
  it('por defecto es una confirmación: role="status" y el ícono check', () => {
    render(<MensajeInformativo mensaje="Plan de nivelación registrado" />);
    const estado = screen.getByRole('status');
    expect(estado).toHaveTextContent('Plan de nivelación registrado');
    expect(estado).toHaveClass('confirmacion');
    expect(estado.querySelector('svg path')).toHaveAttribute(
      'd',
      'M20 6 9 17l-5-5',
    );
  });

  it('tipo informativo: role="status", otro tono y el ícono info', () => {
    render(
      <MensajeInformativo
        mensaje="La atención requiere el consentimiento informado del acudiente"
        tipo="informativo"
      />,
    );
    const estado = screen.getByRole('status');
    expect(estado).toHaveClass('informativo');
    const icono = estado.querySelector('svg')!;
    expect(icono).toHaveAttribute('aria-hidden', 'true');
    expect(icono.querySelector('circle')).toHaveAttribute('r', '10');
  });

  it('sin mensaje no pinta nada', () => {
    const { container } = render(<MensajeInformativo mensaje={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
