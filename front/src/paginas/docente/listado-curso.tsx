import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { useParams } from 'react-router';
import {
  formatearAsistencia,
  formatearFechaHora,
  formatearNota,
} from '../../componentes/formato';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import {
  consultarCurso,
  type ConsultaCurso,
  type RegistroCurso,
} from '../../servicios-api/docente';
import { useConsulta } from '../../componentes/use-consulta';
import tabla from '../../componentes/tabla.module.css';
import estilos from './docente.module.css';
import { FormularioAlerta } from './formulario-alerta';
import { PlantillaDocente } from './plantilla-docente';
import {
  ROTULOS_DOCENTE,
  TEXTO_ALERTA_EMITIDA,
  TITULOS_DOCENTE,
} from './textos';
import {
  ROTULOS_PERIODO,
  TEXTO_INFORMACION_NO_DISPONIBLE,
} from '../../componentes/etiquetas';

/*
 * Listado del curso del Docente (CUD01 pasos 3 y 4, rama Docente; sd_CUD01
 * `consultarCurso`) y emisión de alertas sobre él (CUD03; sd_CUD03
 * `seleccionarEstudiante(idRegistro)`).
 *
 * - Estado de la sincronización (ER 3.3.5): fecha y hora reales de la
 *   última sincronización del curso, sin afirmar ni negar que esté
 *   actualizada (respuesta 3 de F2); si nunca se sincronizó, «Información no
 *   disponible» (ER 3.3.1).
 * - Tabla con encabezados semánticos (th con scope, ajuste B). El id del
 *   estudiante no se muestra ni queda en el DOM (ajuste C): las claves de
 *   React usan idRegistro (no llegan al DOM) y los ids del DOM, la posición.
 * - Al cerrar el formulario o tras la confirmación, el foco vuelve al botón
 *   que lo abrió (ajuste B).
 */

export function PaginaListadoCurso() {
  const { idCurso = '' } = useParams();
  // Otro curso, otro listado: estado nuevo.
  return <ListadoCurso key={idCurso} idCurso={idCurso} />;
}

function ListadoCurso({ idCurso }: { idCurso: string }) {
  const { datos: consulta, error } = useConsulta(
    () => consultarCurso(idCurso),
    idCurso,
  );
  const [seleccionado, setSeleccionado] = useState<RegistroCurso | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const disparador = useRef<HTMLButtonElement | null>(null);
  const devolverFoco = useRef(false);

  useEffect(() => {
    if (seleccionado === null && devolverFoco.current) {
      devolverFoco.current = false;
      disparador.current?.focus();
    }
  }, [seleccionado]);

  const abrir = (
    registro: RegistroCurso,
    evento: MouseEvent<HTMLButtonElement>,
  ) => {
    disparador.current = evento.currentTarget;
    setConfirmacion(null);
    setSeleccionado(registro);
  };

  const cerrar = () => {
    devolverFoco.current = true;
    setSeleccionado(null);
  };

  const emitida = () => {
    setConfirmacion(TEXTO_ALERTA_EMITIDA);
    cerrar();
  };

  return (
    <PlantillaDocente titulo={TITULOS_DOCENTE.consultaCurso}>
      <MensajeError mensaje={error} />
      <div aria-busy={consulta === null && error === null}>
        {consulta !== null && (
          <>
            <DatosCurso curso={consulta.curso} />
            <MensajeInformativo mensaje={confirmacion} />
            {consulta.registros.length === 0 ? (
              <MensajeInformativo
                mensaje={consulta.mensaje ?? TEXTO_INFORMACION_NO_DISPONIBLE}
              />
            ) : (
              <TablaCurso registros={consulta.registros} alAbrir={abrir} />
            )}
            {seleccionado !== null && (
              <FormularioAlerta
                key={seleccionado.idRegistro}
                curso={consulta.curso}
                registro={seleccionado}
                alCerrar={cerrar}
                alEmitir={emitida}
              />
            )}
          </>
        )}
      </div>
    </PlantillaDocente>
  );
}

/** Curso, periodo y estado de la sincronización (ER 3.3.5). */
function DatosCurso({ curso }: { curso: ConsultaCurso['curso'] }) {
  return (
    <dl className={estilos['curso']}>
      <dt>{ROTULOS_DOCENTE.curso}</dt>
      <dd>{curso.nombre}</dd>
      <dt>{ROTULOS_PERIODO.periodo}</dt>
      <dd>{curso.periodo}</dd>
      <dt>{ROTULOS_DOCENTE.ultimaSincronizacion}</dt>
      <dd>
        {curso.ultimaSincronizacion === null
          ? TEXTO_INFORMACION_NO_DISPONIBLE
          : formatearFechaHora(curso.ultimaSincronizacion)}
      </dd>
    </dl>
  );
}

function TablaCurso({
  registros,
  alAbrir,
}: {
  registros: readonly RegistroCurso[];
  alAbrir: (
    registro: RegistroCurso,
    evento: MouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  const prefijo = useId();
  return (
    <table className={tabla['tabla']}>
      <thead>
        <tr>
          <th scope="col">{ROTULOS_DOCENTE.estudiante}</th>
          <th scope="col">{ROTULOS_DOCENTE.nota}</th>
          <th scope="col">{ROTULOS_DOCENTE.asistencia}</th>
          <th scope="col">
            <span className={tabla['oculto']}>
              {ROTULOS_DOCENTE.emitirAlerta}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {registros.map((registro, indice) => {
          // Ids del DOM por posición: ningún identificador de la base queda
          // en el DOM (ajuste C; el id del estudiante nunca se usa aquí).
          const idNombre = `${prefijo}-${indice}`;
          return (
            <tr key={registro.idRegistro}>
              <th scope="row" id={idNombre}>
                {registro.estudiante.nombre}
              </th>
              <td
                className={tabla['numero']}
                data-rotulo={ROTULOS_DOCENTE.nota}
              >
                {formatearNota(registro.nota)}
              </td>
              <td
                className={tabla['numero']}
                data-rotulo={ROTULOS_DOCENTE.asistencia}
              >
                {formatearAsistencia(registro.porcentajeAsistencia)}
              </td>
              <td className={tabla['accion']}>
                <button
                  type="button"
                  className={estilos['botonSecundario']}
                  aria-describedby={idNombre}
                  onClick={(evento) => alAbrir(registro, evento)}
                >
                  {ROTULOS_DOCENTE.emitirAlerta}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
