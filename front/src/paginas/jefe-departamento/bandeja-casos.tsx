import { useId } from 'react';
import { useNavigate } from 'react-router';
import {
  NOMBRE_NIVEL_RIESGO,
  ROTULOS_COMUNES,
} from '../../componentes/etiquetas';
import { formatearFecha } from '../../componentes/formato';
import { MensajeError } from '../../componentes/mensaje-error';
import controles from '../../componentes/controles.module.css';
import tabla from '../../componentes/tabla.module.css';
import { useConsulta } from '../../componentes/use-consulta';
import {
  consultarCasosPendientes,
  type Caso,
} from '../../servicios-api/jefe-departamento';
import { PlantillaJefe, RUTAS_JEFE } from './plantilla-jefe-departamento';
import {
  NOMBRE_ORIGEN,
  ROTULOS_CASO,
  TEXTO_SIN_CASOS,
  TITULOS_JEFE,
} from './textos';

/*
 * Bandeja de casos pendientes del programa que dirige el Jefe (CUD04 pasos
 * 1 y 2; sd_CUD04 `listarCasosPendiente`). Solo llegan casos sin canalizar;
 * el backend excluye las solicitudes psicosociales (D18). El id del
 * estudiante y el del caso no quedan en el DOM (como en F2): el botón de
 * cada fila navega al detalle y los ids del DOM son por posición.
 */

/** Las solicitudes no traen nivel de riesgo: la celda queda con un guion. */
export function textoNivel(nivel: Caso['nivelRiesgo']): string {
  return nivel === null ? '—' : NOMBRE_NIVEL_RIESGO[nivel];
}

export function BandejaCasos() {
  const { datos: casos, error } = useConsulta(
    consultarCasosPendientes,
    'bandeja',
  );
  return (
    <PlantillaJefe titulo={TITULOS_JEFE.casosPendientes}>
      <MensajeError mensaje={error} />
      <div aria-busy={casos === null && error === null}>
        {casos !== null &&
          (casos.length === 0 ? (
            <p>{TEXTO_SIN_CASOS}</p>
          ) : (
            <TablaCasos casos={casos} />
          ))}
      </div>
    </PlantillaJefe>
  );
}

function TablaCasos({ casos }: { casos: readonly Caso[] }) {
  const prefijo = useId();
  const navegar = useNavigate();
  return (
    <table className={tabla['tabla']}>
      <thead>
        <tr>
          <th scope="col">{ROTULOS_COMUNES.estudiante}</th>
          <th scope="col">{ROTULOS_COMUNES.fecha}</th>
          <th scope="col">{ROTULOS_CASO.origen}</th>
          <th scope="col">{ROTULOS_COMUNES.nivelRiesgo}</th>
          <th scope="col">
            <span className={tabla['oculto']}>{TITULOS_JEFE.detalleCaso}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {casos.map((caso, indice) => {
          const idNombre = `${prefijo}-${indice}`;
          return (
            <tr key={caso.idCaso}>
              <th scope="row" id={idNombre}>
                {caso.estudiante.nombre}
              </th>
              <td data-rotulo={ROTULOS_COMUNES.fecha}>
                {formatearFecha(caso.fechaCreacion)}
              </td>
              <td data-rotulo={ROTULOS_CASO.origen}>
                {NOMBRE_ORIGEN[caso.origen.tipo]}
              </td>
              <td data-rotulo={ROTULOS_COMUNES.nivelRiesgo}>
                {textoNivel(caso.nivelRiesgo)}
              </td>
              <td className={tabla['accion']}>
                <button
                  type="button"
                  className={controles['boton']}
                  aria-describedby={idNombre}
                  onClick={() => void navegar(RUTAS_JEFE.caso(caso.idCaso))}
                >
                  {TITULOS_JEFE.detalleCaso}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
