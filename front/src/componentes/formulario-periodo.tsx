import { useState, type FormEvent } from 'react';
import { CampoTexto } from './campo-texto';
import controles from './controles.module.css';
import { ROTULOS_PERIODO, TEXTO_INDIQUE_PERIODO } from './etiquetas';
import { LIMITES } from '../servicios-api/limites';

/*
 * Consulta por periodo (F1b; CUD01 del Estudiante y alertas emitidas del
 * Docente). El periodo es texto libre de hasta 20 caracteres, como lo valida
 * el backend (leerPeriodo); el vacío se indica junto al campo con el mismo
 * texto del backend y no se consulta.
 */

export interface PropsFormularioPeriodo {
  alConsultar: (periodo: string) => void;
  ocupado: boolean;
  /** Clase del campo en el rol (por ejemplo, el borde de error). */
  claseCampo?: string;
  /** Texto propio del periodo vacío (el Estudiante tutea, D4b). */
  textoVacio?: string;
  /** Filtro horizontal: campo y botón en una fila (§7.2, D4b). */
  enLinea?: boolean;
}

export function FormularioPeriodo({
  alConsultar,
  ocupado,
  claseCampo,
  textoVacio = TEXTO_INDIQUE_PERIODO,
  enLinea = false,
}: PropsFormularioPeriodo) {
  const [periodo, setPeriodo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const consultar = (evento: FormEvent) => {
    evento.preventDefault();
    const buscado = periodo.trim();
    if (buscado === '') {
      setError(textoVacio);
      return;
    }
    setError(null);
    alConsultar(buscado);
  };

  return (
    <form
      className={
        enLinea
          ? `${controles['formulario']} ${controles['filtro']}`
          : controles['formulario']
      }
      onSubmit={consultar}
      noValidate
    >
      <CampoTexto
        rotulo={ROTULOS_PERIODO.periodo}
        valor={periodo}
        alCambiar={setPeriodo}
        maximo={LIMITES.periodo}
        requerido
        ayuda={ROTULOS_PERIODO.ayuda}
        error={error}
        clase={claseCampo}
      />
      <button type="submit" className={controles['boton']} disabled={ocupado}>
        {ROTULOS_PERIODO.consultar}
      </button>
    </form>
  );
}
