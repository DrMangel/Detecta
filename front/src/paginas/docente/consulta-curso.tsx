import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { LIMITES } from '../../servicios-api/limites';
import estilos from './docente.module.css';
import { PlantillaDocente, RUTAS_DOCENTE } from './plantilla-docente';
import { ROTULOS_DOCENTE, TITULOS_DOCENTE } from './textos';

/*
 * Consulta de curso del Docente (CUD01 paso 2; sd_CUD01 y sd_CUD03
 * `seleccionarCurso(idCurso)`). No hay ruta que liste los cursos del docente:
 * se escribe el código del curso (respuesta 1 de F2; R01, entradas: «código
 * de asignatura»; D22: codigo_asignatura = idCurso). Decisión abierta D37.
 * Máximo 36 caracteres, como `LONGITUD_MAXIMA.identificador` del backend.
 */

export function ConsultaCurso() {
  const navegar = useNavigate();
  const idCodigo = useId();
  const [codigo, setCodigo] = useState('');
  const buscado = codigo.trim();

  const consultar = (evento: FormEvent) => {
    evento.preventDefault();
    if (buscado !== '') {
      void navegar(RUTAS_DOCENTE.curso(buscado));
    }
  };

  return (
    <PlantillaDocente titulo={TITULOS_DOCENTE.consultaCurso}>
      <form className={estilos['formulario']} onSubmit={consultar} noValidate>
        <div className={estilos['campo']}>
          <label htmlFor={idCodigo}>{ROTULOS_DOCENTE.codigoCurso}</label>
          <input
            id={idCodigo}
            type="text"
            value={codigo}
            maxLength={LIMITES.identificador}
            required
            autoComplete="off"
            onChange={(evento) => setCodigo(evento.target.value)}
          />
        </div>
        {/* Sin código no se consulta (no hay texto aprobado para el vacío). */}
        <button
          type="submit"
          className={estilos['boton']}
          disabled={buscado === ''}
        >
          {ROTULOS_DOCENTE.consultar}
        </button>
      </form>
    </PlantillaDocente>
  );
}
