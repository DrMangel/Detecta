import { useId } from 'react';
import { useNavigate } from 'react-router';
import { ROTULOS_COMUNES } from '../../componentes/etiquetas';
import { formatearFecha } from '../../componentes/formato';
import { Icono } from '../../componentes/icono';
import { InsigniaRiesgo } from '../../componentes/insignias';
import { MensajeError } from '../../componentes/mensaje-error';
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
  AYUDA_BANDEJA,
  NOMBRE_ORIGEN,
  ROTULOS_CASO,
  ROTULOS_DISENO_JEFE,
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
 *
 * Diseño de F5b (D6; §7.4, maquetas 06 y 18): tabla compacta y fila que se
 * abre entera. El área de clic de la fila es el pseudoelemento del botón
 * «Detalle del caso», que sigue siendo el único control (teclado y lector de
 * pantalla) y conserva el estado de origen.
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

/** Las solicitudes no traen nivel de riesgo: un guion en lugar de la insignia. */
export function NivelCaso({ nivel }: { nivel: Caso['nivelRiesgo'] }) {
  if (nivel === null) {
    return <>—</>;
  }
  return <InsigniaRiesgo nivel={nivel} />;
}

export function BandejaCasos({ tipo }: { tipo: TipoBandeja }) {
  const bandeja = BANDEJAS[tipo];
  const { datos: casos, error } = useConsulta(bandeja.consultar, tipo);
  return (
    <PlantillaJefe titulo={bandeja.titulo} ayuda={AYUDA_BANDEJA[tipo]}>
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
    <div className={tabla['contenedor']}>
      <table className={`${tabla['tabla']} ${tabla['compacta']}`}>
        <thead>
          <tr>
            <th scope="col">{ROTULOS_COMUNES.estudiante}</th>
            <th scope="col">{ROTULOS_COMUNES.fecha}</th>
            <th scope="col">{ROTULOS_CASO.origen}</th>
            <th scope="col">{ROTULOS_COMUNES.nivelRiesgo}</th>
            <th scope="col">
              <span className={oculto['oculto']}>
                {ROTULOS_DISENO_JEFE.abrir}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {casos.map((caso, indice) => {
            const idNombre = `${prefijo}-${indice}`;
            return (
              <tr key={caso.idCaso} className={tabla['fila-abrible']}>
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
                  <NivelCaso nivel={caso.nivelRiesgo} />
                </td>
                <td className={tabla['accion']}>
                  <button
                    type="button"
                    className={tabla['abrir-fila']}
                    aria-describedby={idNombre}
                    onClick={() =>
                      void navegar(RUTAS_JEFE.caso(caso.idCaso), {
                        state: { origen },
                      })
                    }
                  >
                    <span className={oculto['oculto']}>
                      {TITULOS_JEFE.detalleCaso}
                    </span>
                    <Icono nombre="chevron-right" />
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
