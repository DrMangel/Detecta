import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GrupoOpciones } from './grupo-opciones';

/*
 * Grupo de opciones excluyentes (F1b; tipo de apoyo en F1, nivel de riesgo
 * en F2): fieldset con leyenda, sin valor por defecto, aria-invalid solo si
 * el grupo lo declara.
 */

const ETIQUETAS = { BAJO: 'Bajo', MEDIO: 'Medio', ALTO: 'Alto' } as const;
const OPCIONES = ['BAJO', 'MEDIO', 'ALTO'] as const;

describe('GrupoOpciones', () => {
  it('fieldset con leyenda y una opción por valor, en orden y sin ninguna marcada', () => {
    render(
      <GrupoOpciones
        leyenda="Nivel de riesgo"
        opciones={OPCIONES}
        etiquetas={ETIQUETAS}
        valor={null}
        alCambiar={() => undefined}
      />,
    );
    const grupo = screen.getByRole('group', { name: 'Nivel de riesgo' });
    const opciones = within(grupo).getAllByRole('radio');
    expect(opciones.map((o) => o.getAttribute('value'))).toEqual([
      'BAJO',
      'MEDIO',
      'ALTO',
    ]);
    opciones.forEach((o) => expect(o).not.toBeChecked());
    expect(grupo).not.toHaveAttribute('aria-invalid');
    // Todas comparten el mismo nombre: son excluyentes.
    expect(new Set(opciones.map((o) => o.getAttribute('name'))).size).toBe(1);
  });

  it('marca el valor actual y avisa el elegido', async () => {
    const alCambiar = vi.fn();
    render(
      <GrupoOpciones
        leyenda="Nivel de riesgo"
        opciones={OPCIONES}
        etiquetas={ETIQUETAS}
        valor="MEDIO"
        alCambiar={alCambiar}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Medio' })).toBeChecked();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Alto' }));
    expect(alCambiar).toHaveBeenCalledWith('ALTO');
  });

  it('invalido: aria-invalid en el grupo', () => {
    render(
      <GrupoOpciones
        leyenda="Nivel de riesgo"
        opciones={OPCIONES}
        etiquetas={ETIQUETAS}
        valor={null}
        alCambiar={() => undefined}
        invalido
      />,
    );
    expect(
      screen.getByRole('group', { name: 'Nivel de riesgo' }),
    ).toHaveAttribute('aria-invalid', 'true');
  });

  it('selección en caja (§4, D3b): clases del grupo y de cada opción, y aria-invalid', () => {
    render(
      <GrupoOpciones
        leyenda="Nivel de riesgo"
        opciones={OPCIONES}
        etiquetas={ETIQUETAS}
        valor={null}
        alCambiar={() => undefined}
        invalido
        clase="propia-del-rol"
      />,
    );
    const grupo = screen.getByRole('group', { name: 'Nivel de riesgo' });
    expect(grupo).toHaveClass('grupo', 'grupo-cajas', 'propia-del-rol');
    expect(grupo).toHaveAttribute('aria-invalid', 'true');
    for (const opcion of within(grupo).getAllByRole('radio')) {
      expect(opcion.closest('label')).toHaveClass('opcion-caja');
    }
  });
});
