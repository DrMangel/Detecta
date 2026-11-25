import { useId } from 'react';
import { Link } from 'react-router';
import { ROTULOS_COMUNES } from '../../componentes/etiquetas';
import { formatearFecha } from '../../componentes/formato';
import { Icono } from '../../componentes/icono';
import { InsigniaEstado, type TonoEstado } from '../../componentes/insignias';
import { MensajeError } from '../../componentes/mensaje-error';
import controles from '../../componentes/controles.module.css';
import oculto from '../../componentes/oculto.module.css';
import tabla from '../../componentes/tabla.module.css';
import { useConsulta } from '../../componentes/use-consulta';
import {
  consultarCasosPsicologo,
  type CasoPsicologo,
  type EstadoCaso,
} from '../../servicios-api/psicologo';
import { PlantillaPsicologo, RUTAS_PSICOLOGO } from './plantilla-psicologo';
import {
  AYUDA_REMISIONES,
  NOMBRE_ESTADO_CASO,
  ROTULOS_PSICOLOGO,
  TEXTO_SIN_CASOS_PSICOLOGO,
  TITULOS_PSICOLOGO,
} from './textos';

/*
 * Bandeja CUD06: remisiones pendientes y asignadas a la sesión del Psicólogo.
 *
 * Diseño de F5b (D7a; §7.5, maqueta 09): ayuda, tabla compacta por sección,
 * estado en insignia y la fila entera que se abre con «Ver expediente» (el
 * ::after del enlace cubre la fila, como en las bandejas del Jefe).
 */

/*
 * Tono de cada estado del caso (§4; maqueta 09 y respuesta 3 de D7):
 * pendiente y terminados sin atención en neutro, en curso en azul, en
 * seguimiento y cerrado en verde. Los nombres son los del enumerado
 * EstadoCaso del backend.
 */
const TONO_ESTADO_CASO: Readonly<Record<EstadoCaso, TonoEstado>> = {
  PENDIENTE: 'neutro',
  EN_NIVELACION: 'azul',
  EN_EVALUACION: 'azul',
  CITADO: 'azul',
  EN_SEGUIMIENTO: 'verde',
  CERRADO: 'verde',
  ARCHIVADO: 'neutro',
  REORIENTADO: 'neutro',
};

export function EspacioPsicologo() {
  const { datos: casos, error } = useConsulta(
    consultarCasosPsicologo,
    'remisiones-psicologo',
  );
  return (
    <PlantillaPsicologo
      titulo={TITULOS_PSICOLOGO.remisiones}
      ayuda={AYUDA_REMISIONES}
    >
      <MensajeError mensaje={error} />
      <div aria-busy={casos === null && error === null}>
        <ContenidoBandeja casos={casos} />
      </div>
    </PlantillaPsicologo>
  );
}

function ContenidoBandeja({
  casos,
}: {
  casos: readonly CasoPsicologo[] | null;
}) {
  if (casos === null) return null;
  if (casos.length === 0) return <p>{TEXTO_SIN_CASOS_PSICOLOGO}</p>;
  const sinAsignar = casos.filter((caso) => caso.psicologo === null);
  const asignados = casos.filter((caso) => caso.psicologo !== null);
  return (
    <>
      {sinAsignar.length > 0 && (
        <GrupoRemisiones
          titulo={ROTULOS_PSICOLOGO.casosSinAsignar}
          casos={sinAsignar}
        />
      )}
      {asignados.length > 0 && (
        <GrupoRemisiones
          titulo={ROTULOS_PSICOLOGO.casosAsignados}
          casos={asignados}
        />
      )}
    </>
  );
}

function GrupoRemisiones({
  titulo,
  casos,
}: {
  titulo: string;
  casos: readonly CasoPsicologo[];
}) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo} className={controles['seccion']}>
      <h2 id={idTitulo}>{titulo}</h2>
      <TablaRemisiones casos={casos} />
    </section>
  );
}

function TablaRemisiones({ casos }: { casos: readonly CasoPsicologo[] }) {
  const prefijo = useId();
  return (
    <div className={tabla['contenedor']}>
      <table className={`${tabla['tabla']} ${tabla['compacta']}`}>
        <thead>
          <tr>
            <th scope="col">{ROTULOS_COMUNES.estudiante}</th>
            <th scope="col">{ROTULOS_COMUNES.fecha}</th>
            <th scope="col">{ROTULOS_COMUNES.estado}</th>
            <th scope="col">
              <span className={oculto['oculto']}>
                {ROTULOS_PSICOLOGO.verExpediente}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {casos.map((caso, indice) => {
            const idNombre = `${prefijo}-${indice}`;
            return (
              <tr key={indice} className={tabla['fila-abrible']}>
                <th scope="row" id={idNombre}>
                  {caso.estudiante.nombre}
                </th>
                <td data-rotulo={ROTULOS_COMUNES.fecha}>
                  {formatearFecha(caso.fechaCreacion)}
                </td>
                <td data-rotulo={ROTULOS_COMUNES.estado}>
                  <InsigniaEstado
                    texto={NOMBRE_ESTADO_CASO[caso.estado]}
                    tono={TONO_ESTADO_CASO[caso.estado]}
                  />
                </td>
                <td className={tabla['accion']}>
                  <Link
                    to={RUTAS_PSICOLOGO.caso(caso.idCaso)}
                    className={`${tabla['abrir-fila']} ${tabla['abrir-fila-texto']}`}
                    aria-describedby={idNombre}
                  >
                    {ROTULOS_PSICOLOGO.verExpediente}
                    <Icono nombre="chevron-right" tamano={16} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
