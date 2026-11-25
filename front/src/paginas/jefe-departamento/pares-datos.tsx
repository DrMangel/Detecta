import type { ReactNode } from 'react';
import estilos from './jefe-departamento.module.css';

/*
 * Pares rótulo-valor del Jefe en cuadrícula, con el rótulo encima del valor
 * (F5b-diseño, D6; §7.4, maquetas 07 y 08). Los usan los datos del caso y
 * cada plan; los textos libres (justificación, motivo, cronograma) ocupan
 * el ancho completo.
 */

export interface Dato {
  rotulo: string;
  valor: ReactNode;
  ancho?: true;
  /** Clase del valor (por ejemplo, el cronograma con sus saltos de línea). */
  claseValor?: string;
}

export function ParesDatos({
  datos,
  columnas = 2,
}: {
  datos: readonly Dato[];
  columnas?: 2 | 3;
}) {
  return (
    <dl className={`${estilos['pares']} ${estilos[`columnas-${columnas}`]}`}>
      {datos.map(({ rotulo, valor, ancho, claseValor }) => (
        <div
          key={rotulo}
          className={ancho ? estilos['ancho-completo'] : undefined}
        >
          <dt>{rotulo}</dt>
          <dd className={claseValor}>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
