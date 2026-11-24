import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CampoTexto, type PropsCampoTexto } from './campo-texto';

/*
 * Campo de texto de las pantallas de los roles (F1b): etiqueta asociada,
 * sin autocompletado, maxLength del contrato y la descripción accesible en
 * el mismo orden que tenían F1 y F2 (ayuda, contador, error externo, error).
 */

function Controlado(props: Omit<PropsCampoTexto, 'valor' | 'alCambiar'>) {
  const [valor, setValor] = useState('');
  return <CampoTexto {...props} valor={valor} alCambiar={setValor} />;
}

describe('CampoTexto', () => {
  it('una línea: etiqueta asociada, texto, maxLength, sin autocompletado y requerido si se pide', async () => {
    const alCambiar = vi.fn();
    render(
      <CampoTexto
        rotulo="Código del curso"
        valor=""
        alCambiar={alCambiar}
        maximo={36}
        requerido
      />,
    );
    const campo = screen.getByLabelText('Código del curso');
    expect(campo.tagName).toBe('INPUT');
    expect(campo).toHaveAttribute('type', 'text');
    expect(campo).toHaveAttribute('maxLength', '36');
    expect(campo).toHaveAttribute('autocomplete', 'off');
    expect(campo).toBeRequired();
    // Sin error declarado no lleva aria-invalid ni descripción.
    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(campo).not.toHaveAttribute('aria-describedby');
    await userEvent.setup().type(campo, 'A');
    expect(alCambiar).toHaveBeenCalledWith('A');
  });

  it('ayuda y error: descripción «ayuda error», aria-invalid y el error con role="alert"', () => {
    const { rerender } = render(
      <CampoTexto
        rotulo="Periodo académico"
        valor=""
        alCambiar={() => undefined}
        maximo={20}
        ayuda="Por ejemplo: 2026-2"
        error={null}
      />,
    );
    const campo = screen.getByLabelText('Periodo académico');
    expect(campo).toHaveAttribute('aria-invalid', 'false');
    expect(campo).toHaveAccessibleDescription('Por ejemplo: 2026-2');
    rerender(
      <CampoTexto
        rotulo="Periodo académico"
        valor=""
        alCambiar={() => undefined}
        maximo={20}
        ayuda="Por ejemplo: 2026-2"
        error="Indique el periodo académico."
      />,
    );
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(
      'Por ejemplo: 2026-2 Indique el periodo académico.',
    );
    // Error de campo en línea, con ícono y sin tarjeta (§4, D3b).
    expect(screen.getByRole('alert')).toHaveClass('en-linea');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Indique el periodo académico.',
    );
  });

  it('varias líneas: textarea no requerida, sin descripción si no hay error', () => {
    render(
      <CampoTexto
        rotulo="Disponibilidad horaria (opcional)"
        valor=""
        alCambiar={() => undefined}
        maximo={500}
        multilinea
      />,
    );
    const campo = screen.getByLabelText('Disponibilidad horaria (opcional)');
    expect(campo.tagName).toBe('TEXTAREA');
    expect(campo).not.toBeRequired();
    expect(campo).toHaveAttribute('maxLength', '500');
    expect(campo).toHaveAttribute('autocomplete', 'off');
  });

  it('contador: «n / máximo» como descripción, actualizado al escribir', async () => {
    render(
      <Controlado rotulo="Justificación" maximo={2000} multilinea contador />,
    );
    const campo = screen.getByLabelText('Justificación');
    expect(campo).toHaveAccessibleDescription('0 / 2000');
    await userEvent.setup().type(campo, 'Hola');
    expect(campo).toHaveAccessibleDescription('4 / 2000');
  });

  it('error externo: invalido y descritoPor se suman después del contador', () => {
    render(
      <>
        <CampoTexto
          rotulo="Justificación"
          valor=""
          alCambiar={() => undefined}
          maximo={2000}
          multilinea
          contador
          invalido
          descritoPor="error-externo"
        />
        <p id="error-externo">Complete el nivel de riesgo y la justificación</p>
      </>,
    );
    const campo = screen.getByLabelText('Justificación');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(
      '0 / 2000 Complete el nivel de riesgo y la justificación',
    );
  });
});
