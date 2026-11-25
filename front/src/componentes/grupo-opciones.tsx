import { useId } from 'react';
import controles from './controles.module.css';

/*
 * Grupo de opciones excluyentes (F1b; tipo de apoyo en F1, nivel de riesgo
 * en F2). Sin valor por defecto: hay que elegir. aria-invalid solo aparece si
 * el grupo lo declara. Cada opción es una caja (especificación §4, D3b): en
 * celular, una por fila; desde 48 rem se reparten el ancho. `clase` añade lo
 * que sea propio de un rol.
 */

export interface PropsGrupoOpciones<T extends string> {
  leyenda: string;
  opciones: readonly T[];
  etiquetas: Readonly<Record<T, string>>;
  valor: T | null;
  alCambiar: (valor: T) => void;
  invalido?: boolean;
  clase?: string;
}

export function GrupoOpciones<T extends string>({
  leyenda,
  opciones,
  etiquetas,
  valor,
  alCambiar,
  invalido,
  clase,
}: PropsGrupoOpciones<T>) {
  const nombre = useId();
  return (
    <fieldset
      className={[controles['grupo'], controles['grupo-cajas'], clase]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={invalido}
    >
      <legend>{leyenda}</legend>
      {opciones.map((opcion) => (
        <label key={opcion} className={controles['opcion-caja']}>
          <input
            type="radio"
            name={nombre}
            value={opcion}
            checked={valor === opcion}
            onChange={() => alCambiar(opcion)}
          />
          {etiquetas[opcion]}
        </label>
      ))}
    </fieldset>
  );
}
