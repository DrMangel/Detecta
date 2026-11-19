import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormularioPeriodo } from './formulario-periodo';

/*
 * Consulta por periodo (F1b; CUD01 del Estudiante y alertas emitidas del
 * Docente): periodo de texto libre de hasta 20 caracteres con su ayuda; el
 * vacío se indica junto al campo sin consultar; el periodo viaja sin
 * espacios a los lados.
 */

describe('FormularioPeriodo', () => {
  it('campo «Periodo académico» de 20, ayuda «Por ejemplo: 2026-2» y botón «Consultar»', () => {
    render(<FormularioPeriodo alConsultar={() => undefined} ocupado={false} />);
    const campo = screen.getByLabelText('Periodo académico');
    expect(campo).toHaveAttribute('maxLength', '20');
    expect(campo).toBeRequired();
    expect(campo).toHaveAccessibleDescription('Por ejemplo: 2026-2');
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeEnabled();
  });

  it('vacío o solo espacios: «Indique el periodo académico.» junto al campo y no consulta', async () => {
    const alConsultar = vi.fn();
    render(<FormularioPeriodo alConsultar={alConsultar} ocupado={false} />);
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText('Periodo académico'), '   ');
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Indique el periodo académico.',
    );
    expect(screen.getByLabelText('Periodo académico')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(alConsultar).not.toHaveBeenCalled();
  });

  it('periodo válido: consulta sin espacios a los lados y borra el error anterior', async () => {
    const alConsultar = vi.fn();
    render(<FormularioPeriodo alConsultar={alConsultar} ocupado={false} />);
    const usuario = userEvent.setup();
    const boton = screen.getByRole('button', { name: 'Consultar' });
    await usuario.click(boton);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await usuario.type(screen.getByLabelText('Periodo académico'), ' 2026-2 ');
    await usuario.click(boton);
    expect(alConsultar).toHaveBeenCalledWith('2026-2');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ocupado: el botón queda deshabilitado', () => {
    render(<FormularioPeriodo alConsultar={() => undefined} ocupado />);
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled();
  });
});
