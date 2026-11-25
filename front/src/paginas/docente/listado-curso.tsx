import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { useParams } from 'react-router';
import {
  formatearAsistencia,
  formatearFechaHora,
  formatearNota,
} from '../../componentes/formato';
import { Icono } from '../../componentes/icono';
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
import oculto from '../../componentes/oculto.module.css';
import tabla from '../../componentes/tabla.module.css';
import controles from '../../componentes/controles.module.css';
import estilos from './docente.module.css';
import { FormularioAlerta } from './formulario-alerta';
import { PlantillaDocente } from './plantilla-docente';
import {
  ayudaCurso,
  cantidadEstudiantes,
  ROTULOS_DOCENTE,
  TEXTO_ALERTA_EMITIDA,
  TITULOS_DOCENTE,
} from './textos';
import { TEXTO_INFORMACION_NO_DISPONIBLE } from '../../componentes/etiquetas';

/*
 * Listado del curso del Docente (CUD01 pasos 3 y 4, rama Docente; sd_CUD01
 * `consultarCurso`) y emisión de alertas sobre él (CUD03; sd_CUD03
 * `seleccionarEstudiante(idRegistro)`).
 *
 * - Curso, código y periodo en la ayuda bajo el título (§7.3; D5).
 * - Estado de la sincronización (ER 3.3.5), en su tarjeta: fecha y hora reales
 *   de la última sincronización del curso, sin afirmar ni negar que esté
 *   actualizada (respuesta 3 de F2); si nunca se sincronizó, «Información no
 *   disponible» (ER 3.3.1). Al lado, la cantidad de estudiantes del listado.
 * - Con el formulario abierto, la fila elegida se resalta y las demás se
 *   atenúan (§7.3), sin bajar su texto de 4,5:1.
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
    <PlantillaDocente
      titulo={TITULOS_DOCENTE.consultaCurso}
      ayuda={
        consulta === null
          ? undefined
          : ayudaCurso(
              consulta.curso.nombre,
              consulta.curso.idCurso,
              consulta.curso.periodo,
            )
      }
    >
      <MensajeError mensaje={error} />
      <div aria-busy={consulta === null && error === null}>
        {consulta !== null && (
          <>
            <ResumenCurso consulta={consulta} />
            <MensajeInformativo mensaje={confirmacion} />
            {consulta.registros.length === 0 ? (
              <MensajeInformativo
                mensaje={consulta.mensaje ?? TEXTO_INFORMACION_NO_DISPONIBLE}
              />
            ) : (
              <TablaCurso
                registros={consulta.registros}
                seleccionado={seleccionado}
                alAbrir={abrir}
              />
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

/** Estado de la sincronización (ER 3.3.5) y cantidad de estudiantes (§7.3). */
function ResumenCurso({ consulta }: { consulta: ConsultaCurso }) {
  const { ultimaSincronizacion } = consulta.curso;
  return (
    <div className={estilos['resumen']}>
      <div className={`${controles['tarjeta']} ${estilos['dato']}`}>
        <Icono nombre="clock" />
        <span>
          <strong>{ROTULOS_DOCENTE.ultimaSincronizacion}</strong>:{' '}
          <span>
            {ultimaSincronizacion === null
              ? TEXTO_INFORMACION_NO_DISPONIBLE
              : formatearFechaHora(ultimaSincronizacion)}
          </span>
        </span>
      </div>
      <div className={`${controles['tarjeta']} ${estilos['dato']}`}>
        <span>{cantidadEstudiantes(consulta.registros.length)}</span>
      </div>
    </div>
  );
}

/** Sin formulario abierto, ninguna fila cambia; con él, resaltada o atenuada. */
function claseFila(
  registro: RegistroCurso,
  seleccionado: RegistroCurso | null,
) {
  if (seleccionado === null) {
    return undefined;
  }
  return registro.idRegistro === seleccionado.idRegistro
    ? estilos['seleccionada']
    : estilos['atenuada'];
}

function TablaCurso({
  registros,
  seleccionado,
  alAbrir,
}: {
  registros: readonly RegistroCurso[];
  seleccionado: RegistroCurso | null;
  alAbrir: (
    registro: RegistroCurso,
    evento: MouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  const prefijo = useId();
  return (
    <div className={tabla['contenedor']}>
      <table className={`${tabla['tabla']} ${tabla['compacta']}`}>
        <thead>
          <tr>
            <th scope="col">{ROTULOS_DOCENTE.estudiante}</th>
            <th scope="col">{ROTULOS_DOCENTE.nota}</th>
            <th scope="col">{ROTULOS_DOCENTE.asistencia}</th>
            <th scope="col">
              <span className={oculto['oculto']}>
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
              <tr
                key={registro.idRegistro}
                className={claseFila(registro, seleccionado)}
              >
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
                    className={`${controles['boton-secundario']} ${controles['boton-compacto']}`}
                    aria-describedby={idNombre}
                    onClick={(evento) => alAbrir(registro, evento)}
                  >
                    <Icono nombre="bell" tamano={16} />
                    {ROTULOS_DOCENTE.emitirAlerta}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
