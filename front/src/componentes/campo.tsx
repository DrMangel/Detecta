import { useId } from 'react';
import controles from './controles.module.css';

/* Campo de formulario con su etiqueta asociada (accesibilidad base, F0). */
export function Campo({
  rotulo,
  tipo,
  valor,
  alCambiar,
  autocompletar,
}: {
  rotulo: string;
  tipo: 'email' | 'password';
  valor: string;
  alCambiar: (valor: string) => void;
  autocompletar: 'username' | 'current-password' | 'new-password';
}) {
  const id = useId();
  return (
    <div className={controles['campo']}>
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        type={tipo}
        value={valor}
        required
        autoComplete={autocompletar}
        onChange={(evento) => alCambiar(evento.target.value)}
      />
    </div>
  );
}
