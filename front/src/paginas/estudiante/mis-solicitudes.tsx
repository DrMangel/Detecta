import controles from '../../componentes/controles.module.css';
import { formatearFecha } from '../../componentes/formato';
import {
  InsigniaEstado,
  TONO_ESTADO_ATENCION,
} from '../../componentes/insignias';
import { MensajeError } from '../../componentes/mensaje-error';
import { useConsulta } from '../../componentes/use-consulta';
import {
  consultarSolicitudes,
  type Solicitud,
} from '../../servicios-api/estudiante';
import estilos from './estudiante.module.css';
import { PlantillaEstudiante } from './plantilla-estudiante';
import {
  ROTULOS_ESTUDIANTE,
  TEXTO_SIN_SOLICITUDES,
  TITULOS_ESTUDIANTE,
} from './textos';
import { NOMBRE_ESTADO, NOMBRE_TIPO_APOYO } from '../../componentes/etiquetas';

/*
 * Solicitudes del Estudiante con su estado (CUD01 2.b; sd_CUD01
 * verSolicitudes). El estado es «Pendiente» o «Atendida», derivado del caso
 * por el backend (D27): no se muestra la ruta, el avance ni el resultado del
 * caso. El código de rastreo es el idOrigen (D28).
 *
 * La consulta al montar (y el doble GET de StrictMode en desarrollo) la
 * resuelve useConsulta.
 */
export function MisSolicitudes() {
  const { datos: solicitudes, error } = useConsulta(
    consultarSolicitudes,
    'solicitudes',
  );

  return (
    <PlantillaEstudiante titulo={TITULOS_ESTUDIANTE.solicitudes}>
      <MensajeError mensaje={error} />
      <div aria-busy={solicitudes === null && error === null}>
        {solicitudes !== null &&
          (solicitudes.length === 0 ? (
            <p>{TEXTO_SIN_SOLICITUDES}</p>
          ) : (
            <ul className={estilos['lista']}>
              {solicitudes.map((solicitud) => (
                <li
                  key={solicitud.codigo}
                  className={`${controles['tarjeta']} ${controles['tarjeta-estudiante']}`}
                >
                  <DatosDeSolicitud solicitud={solicitud} />
                </li>
              ))}
            </ul>
          ))}
      </div>
    </PlantillaEstudiante>
  );
}

function DatosDeSolicitud({ solicitud }: { solicitud: Solicitud }) {
  return (
    <dl className={estilos['datos']}>
      <dt>{ROTULOS_ESTUDIANTE.fecha}</dt>
      <dd>{formatearFecha(solicitud.fecha)}</dd>
      <dt>{ROTULOS_ESTUDIANTE.tipoApoyo}</dt>
      <dd>{NOMBRE_TIPO_APOYO[solicitud.tipoApoyo]}</dd>
      <dt>{ROTULOS_ESTUDIANTE.motivo}</dt>
      <dd>{solicitud.motivo}</dd>
      {/* La disponibilidad es opcional (B6, ajuste C): sin fila si vino vacía. */}
      {solicitud.disponibilidad !== '' && (
        <>
          <dt>{ROTULOS_ESTUDIANTE.disponibilidad}</dt>
          <dd>{solicitud.disponibilidad}</dd>
        </>
      )}
      <dt>{ROTULOS_ESTUDIANTE.estado}</dt>
      <dd>
        <InsigniaEstado
          texto={NOMBRE_ESTADO[solicitud.estado]}
          tono={TONO_ESTADO_ATENCION[solicitud.estado]}
        />
      </dd>
      <dt>{ROTULOS_ESTUDIANTE.codigo}</dt>
      <dd>{solicitud.codigo}</dd>
    </dl>
  );
}
