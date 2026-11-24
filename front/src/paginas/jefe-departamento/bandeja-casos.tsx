import { useId } from 'react';
import { useNavigate } from 'react-router';
import {
  NOMBRE_NIVEL_RIESGO,
  ROTULOS_COMUNES,
} from '../../componentes/etiquetas';
import { formatearFecha } from '../../componentes/formato';
import { MensajeError } from '../../componentes/mensaje-error';
import controles from '../../componentes/controles.module.css';
import oculto from '../../componentes/oculto.module.css';
import tabla from '../../componentes/tabla.module.css';
import { useConsulta } from '../../componentes/use-consulta';
import {
  consultarCasosPendientes,
  consultarCasosRutaAcademica,
  type Caso,
} from '../../servicios-api/jefe-departamento';
import {
  PlantillaJefe,
  RUTAS_JEFE,
  type TipoBandeja,
} from './plantilla-jefe-departamento';
import {
  NOMBRE_ORIGEN,
  ROTULOS_CASO,
  TEXTO_SIN_CASOS,
  TEXTO_SIN_CASOS_RUTA_ACADEMICA,
  TITULOS_JEFE,
} from './textos';

/*
 * Bandejas del programa que dirige el Jefe, con la misma tabla:
 * - «Casos pendientes» (CUD04 pasos 1 y 2; sd_CUD04 `listarCasosPendiente`):
 *   solo casos sin canalizar.
 * - «En ruta académica» (F5b, cierra D38): casos canalizados a la ruta
 *   académica, para volver a registrar o finalizar su plan (CUD05, 1.a).
 * El backend excluye las solicitudes psicosociales (D18). El id del
 * estudiante y el del caso no quedan en el DOM (como en F2): el botón de
 * cada fila navega al detalle y los ids del DOM son por posición. La
 * navegación lleva la bandeja de origen, para el enlace de regreso del
 * detalle y el resalte del menú (F5b; Manual 3.1.2.2.6, Tabla 30).
 */

const BANDEJAS = {
  pendientes: {
    consultar: consultarCasosPendientes,
    titulo: TITULOS_JEFE.casosPendientes,
    textoVacio: TEXTO_SIN_CASOS,
  },
  rutaAcademica: {
    consultar: consultarCasosRutaAcademica,
    titulo: TITULOS_JEFE.rutaAcademica,
    textoVacio: TEXTO_SIN_CASOS_RUTA_ACADEMICA,
  },
} as const satisfies Record<TipoBandeja, unknown>;

/** Las solicitudes no traen nivel de riesgo: la celda queda con un guion. */
export function textoNivel(nivel: Caso['nivelRiesgo']): string {
  return nivel === null ? '—' : NOMBRE_NIVEL_RIESGO[nivel];
}

export function BandejaCasos({ tipo }: { tipo: TipoBandeja }) {
  const bandeja = BANDEJAS[tipo];
  const { datos: casos, error } = useConsulta(bandeja.consultar, tipo);
  return (
    <PlantillaJefe titulo={bandeja.titulo}>
      <MensajeError mensaje={error} />
      <div aria-busy={casos === null && error === null}>
        {casos !== null &&
          (casos.length === 0 ? (
            <p>{bandeja.textoVacio}</p>
          ) : (
            <TablaCasos casos={casos} origen={tipo} />
          ))}
      </div>
    </PlantillaJefe>
  );
}

function TablaCasos({
  casos,
  origen,
}: {
  casos: readonly Caso[];
  origen: TipoBandeja;
}) {
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
            <span className={oculto['oculto']}>{TITULOS_JEFE.detalleCaso}</span>
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
                  onClick={() =>
                    void navegar(RUTAS_JEFE.caso(caso.idCaso), {
                      state: { origen },
                    })
                  }
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
