import estilos from './cifra-grande.module.css';

/*
 * Cifra grande (especificación de diseño, §4): número de 36 px/800 con su
 * rótulo y, si la hay, la definición (Informes, CUD10).
 */
export function CifraGrande({
  valor,
  rotulo,
  definicion,
}: {
  valor: string;
  rotulo: string;
  definicion?: string;
}) {
  return (
    <div className={estilos['cifra']}>
      <span className={estilos['valor']}>{valor}</span>
      <span className={estilos['rotulo']}>{rotulo}</span>
      {definicion !== undefined && (
        <span className={estilos['definicion']}>{definicion}</span>
      )}
    </div>
  );
}
