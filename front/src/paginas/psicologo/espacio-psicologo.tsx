import { useId } from 'react';
import { Link } from 'react-router';
import { ROTULOS_COMUNES } from '../../componentes/etiquetas';
import { formatearFecha } from '../../componentes/formato';
import { MensajeError } from '../../componentes/mensaje-error';
import controles from '../../componentes/controles.module.css';
import tabla from '../../componentes/tabla.module.css';
import { useConsulta } from '../../componentes/use-consulta';
import {
  consultarCasosPsicologo,
  type CasoPsicologo,
} from '../../servicios-api/psicologo';
import { PlantillaPsicologo, RUTAS_PSICOLOGO } from './plantilla-psicologo';
import {
  NOMBRE_ESTADO_CASO,
  ROTULOS_PSICOLOGO,
  TEXTO_SIN_CASOS_PSICOLOGO,
  TITULOS_PSICOLOGO,
} from './textos';

/* Bandeja CUD06: remisiones pendientes y asignadas a la sesión del Psicólogo. */
export function EspacioPsicologo() {
  const { datos: casos, error } = useConsulta(
    consultarCasosPsicologo,
    'remisiones-psicologo',
  );
  return (
    <PlantillaPsicologo titulo={TITULOS_PSICOLOGO.remisiones}>
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
    <table className={tabla['tabla']}>
      <thead>
        <tr>
          <th scope="col">{ROTULOS_COMUNES.estudiante}</th>
          <th scope="col">{ROTULOS_COMUNES.fecha}</th>
          <th scope="col">{ROTULOS_COMUNES.estado}</th>
          <th scope="col">
            <span className={tabla['oculto']}>
              {ROTULOS_PSICOLOGO.verExpediente}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {casos.map((caso, indice) => {
          const idNombre = `${prefijo}-${indice}`;
          return (
            <tr key={indice}>
              <th scope="row" id={idNombre}>
                {caso.estudiante.nombre}
              </th>
              <td data-rotulo={ROTULOS_COMUNES.fecha}>
                {formatearFecha(caso.fechaCreacion)}
              </td>
              <td data-rotulo={ROTULOS_COMUNES.estado}>
                {NOMBRE_ESTADO_CASO[caso.estado]}
              </td>
              <td className={tabla['accion']}>
                <Link
                  to={RUTAS_PSICOLOGO.caso(caso.idCaso)}
                  className={controles['boton']}
                  aria-describedby={idNombre}
                >
                  {ROTULOS_PSICOLOGO.verExpediente}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
