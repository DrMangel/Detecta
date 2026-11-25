import type { ReactNode } from 'react';
import estilos from './pares-datos.module.css';

/*
 * Pares rótulo-valor en cuadrícula, con el rótulo encima del valor
 * (F5b-diseño: datos del caso y planes del Jefe en D6; expediente y citas
 * del Psicólogo en D7a; §7.4 y §7.5). Los textos libres ocupan el ancho
 * completo y conservan sus saltos de línea. La clave es la posición: un
 * rótulo puede repetirse (por ejemplo, el consentimiento del expediente).
 */

export interface Dato {
  rotulo: string;
  valor: ReactNode;
  ancho?: true;
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
      {datos.map(({ rotulo, valor, ancho }, indice) => (
        <div
          key={indice}
          className={ancho ? estilos['ancho-completo'] : undefined}
        >
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
