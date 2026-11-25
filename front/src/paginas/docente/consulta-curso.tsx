import { useState, type FormEvent } from 'react';
import { CampoTexto } from '../../componentes/campo-texto';
import { useNavigate } from 'react-router';
import { LIMITES } from '../../servicios-api/limites';
import controles from '../../componentes/controles.module.css';
import { ROTULOS_PERIODO } from '../../componentes/etiquetas';
import estilos from './docente.module.css';
import { PlantillaDocente, RUTAS_DOCENTE } from './plantilla-docente';
import { ROTULOS_DOCENTE, TITULOS_DOCENTE } from './textos';

/*
 * Consulta de curso del Docente (CUD01 paso 2; sd_CUD01 y sd_CUD03
 * `seleccionarCurso(idCurso)`). No hay ruta que liste los cursos del docente:
 * se escribe el código del curso (respuesta 1 de F2; R01, entradas: «código
 * de asignatura»; D22: codigo_asignatura = idCurso). Decisión abierta D37.
 * Máximo 36 caracteres, como `LONGITUD_MAXIMA.identificador` del backend.
 * Diseño de F5b (D5): el filtro en tarjeta, con el campo y el botón en una
 * fila.
 */

export function ConsultaCurso() {
  const navegar = useNavigate();
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
      <div className={`${controles['tarjeta']} ${estilos['bloque-filtro']}`}>
        <form
          className={`${controles['formulario']} ${controles['filtro']}`}
          onSubmit={consultar}
          noValidate
        >
          <CampoTexto
            rotulo={ROTULOS_DOCENTE.codigoCurso}
            valor={codigo}
            alCambiar={setCodigo}
            maximo={LIMITES.identificador}
            requerido
            clase={estilos['campo']}
          />
          {/* Sin código no se consulta (no hay texto aprobado para el vacío). */}
          <button
            type="submit"
            className={controles['boton']}
            disabled={buscado === ''}
          >
            {ROTULOS_PERIODO.consultar}
          </button>
        </form>
      </div>
    </PlantillaDocente>
  );
}
