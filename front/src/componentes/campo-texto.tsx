import { useId } from 'react';
import controles from './controles.module.css';
import { MensajeError } from './mensaje-error';

/*
 * Campo de texto de las pantallas de los roles (F1b; el Campo de F0 sigue
 * aparte para las credenciales). Siempre sin autocompletado (datos
 * confidenciales, plan de F1 §e) y con el maxLength del contrato.
 *
 * La descripción accesible conserva el orden que tenían F1 y F2: ayuda,
 * contador, error externo (descritoPor) y error propio. aria-invalid solo
 * aparece si el campo declara `error` o `invalido`.
 */

export interface PropsCampoTexto {
  rotulo: string;
  valor: string;
  alCambiar: (valor: string) => void;
  maximo: number;
  multilinea?: boolean;
  requerido?: boolean;
  ayuda?: string;
  /** Muestra «n / máximo» (ajuste A de F2). */
  contador?: boolean;
  /** Error propio, debajo del campo; null = sin error. */
  error?: string | null;
  /** aria-invalid cuando el error se muestra fuera del campo. */
  invalido?: boolean;
  /** id de un elemento externo que también describe el campo. */
  descritoPor?: string;
  /** Clase del módulo del rol, para lo que difiere entre roles. */
  clase?: string;
}

function unirIds(ids: (string | false | undefined)[]): string | undefined {
  const presentes = ids.filter((id): id is string => typeof id === 'string');
  return presentes.length === 0 ? undefined : presentes.join(' ');
}

function estaInvalido(props: PropsCampoTexto): boolean | undefined {
  if (props.invalido !== undefined) {
    return props.invalido;
  }
  return props.error === undefined ? undefined : props.error !== null;
}

export function CampoTexto(props: PropsCampoTexto) {
  const { rotulo, valor, alCambiar, maximo, ayuda, error } = props;
  const id = useId();
  const idAyuda = useId();
  const idContador = useId();
  const idError = useId();
  const atributos = {
    id,
    value: valor,
    maxLength: maximo,
    required: props.requerido,
    autoComplete: 'off',
    'aria-invalid': estaInvalido(props),
    'aria-describedby': unirIds([
      ayuda !== undefined && idAyuda,
      props.contador === true && idContador,
      props.descritoPor,
      typeof error === 'string' && idError,
    ]),
  };
  const clase = [controles['campo'], props.clase].filter(Boolean).join(' ');

  return (
    <div className={clase}>
      <label htmlFor={id}>{rotulo}</label>
      {props.multilinea === true ? (
        <textarea
          {...atributos}
          onChange={(evento) => alCambiar(evento.target.value)}
        />
      ) : (
        <input
          {...atributos}
          type="text"
          onChange={(evento) => alCambiar(evento.target.value)}
        />
      )}
      {ayuda !== undefined && (
        <p id={idAyuda} className={controles['ayuda']}>
          {ayuda}
        </p>
      )}
      {props.contador === true && (
        <p
          id={idContador}
          className={`${controles['ayuda']} ${controles['contador']}`}
        >
          {`${valor.length} / ${maximo}`}
        </p>
      )}
      <MensajeError mensaje={error ?? null} id={idError} enLinea />
    </div>
  );
}
