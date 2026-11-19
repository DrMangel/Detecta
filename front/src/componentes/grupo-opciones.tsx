import { useId } from 'react';
import controles from './controles.module.css';

/*
 * Grupo de opciones excluyentes (F1b; tipo de apoyo en F1, nivel de riesgo
 * en F2). Sin valor por defecto: hay que elegir. aria-invalid solo aparece si
 * el grupo lo declara. La disposición del grupo (columna o fila) es de cada
 * rol y llega en `clase`.
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
    <fieldset className={clase} aria-invalid={invalido}>
      <legend>{leyenda}</legend>
      {opciones.map((opcion) => (
        <label key={opcion} className={controles['opcion']}>
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
