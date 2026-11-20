import { useState } from 'react';
import { FormularioPeriodo } from '../../componentes/formulario-periodo';
import { formatearFecha } from '../../componentes/formato';
import { MensajeError } from '../../componentes/mensaje-error';
import {
  consultarAlertasEmitidas,
  type AlertaEmitida,
} from '../../servicios-api/docente';
import { useEnvio } from '../../componentes/use-envio';
import tabla from '../../componentes/tabla.module.css';
import estilos from './docente.module.css';
import { PlantillaDocente } from './plantilla-docente';
import {
  ROTULOS_DOCENTE,
  TEXTO_SIN_ALERTAS_EMITIDAS,
  TITULOS_DOCENTE,
} from './textos';
import {
  NOMBRE_ESTADO,
  NOMBRE_NIVEL_RIESGO,
} from '../../componentes/etiquetas';

/*
 * Alertas emitidas por el Docente (CUD01 2.c; sd_CUD01 `verAlertasEmitidas`
 * y `consultarAlertasEmitidas(periodo)`). Campo de periodo vacío, con la
 * ayuda «Por ejemplo: 2026-2» (respuesta 4 de F2). El estado de atención es
 * «Pendiente» o «Atendida», derivado del caso (D27): sin ruta, avance ni
 * resultado. Solo se pintan los campos conocidos de AlertaEmitida; nunca
 * motivos ni contenido de solicitudes (D18, D19).
 */

export function AlertasEmitidas() {
  const [alertas, setAlertas] = useState<AlertaEmitida[] | null>(null);
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const consultar = async (periodo: string) => {
    const lista = await ejecutar(() => consultarAlertasEmitidas(periodo));
    setAlertas(lista ?? null);
  };

  return (
    <PlantillaDocente titulo={TITULOS_DOCENTE.alertasEmitidas}>
      <FormularioPeriodo
        alConsultar={(periodo) => void consultar(periodo)}
        ocupado={enviando || enEspera}
        claseCampo={estilos['campo']}
      />

      <MensajeError mensaje={error} />
      <div aria-busy={enviando}>
        {alertas !== null &&
          (alertas.length === 0 ? (
            <p>{TEXTO_SIN_ALERTAS_EMITIDAS}</p>
          ) : (
            <TablaAlertas alertas={alertas} />
          ))}
      </div>
    </PlantillaDocente>
  );
}

function TablaAlertas({ alertas }: { alertas: readonly AlertaEmitida[] }) {
  return (
    <table className={tabla['tabla']}>
      <thead>
        <tr>
          <th scope="col">{ROTULOS_DOCENTE.fecha}</th>
          <th scope="col">{ROTULOS_DOCENTE.estudiante}</th>
          <th scope="col">{ROTULOS_DOCENTE.curso}</th>
          <th scope="col">{ROTULOS_DOCENTE.nivelRiesgo}</th>
          <th scope="col">{ROTULOS_DOCENTE.justificacion}</th>
          <th scope="col">{ROTULOS_DOCENTE.estadoAtencion}</th>
        </tr>
      </thead>
      <tbody>
        {alertas.map((alerta) => (
          <tr key={alerta.idAlerta}>
            <td className={tabla['numero']} data-rotulo={ROTULOS_DOCENTE.fecha}>
              {formatearFecha(alerta.fecha)}
            </td>
            <th scope="row" data-rotulo={ROTULOS_DOCENTE.estudiante}>
              {alerta.estudiante.nombre}
            </th>
            <td data-rotulo={ROTULOS_DOCENTE.curso}>{alerta.curso.nombre}</td>
            <td data-rotulo={ROTULOS_DOCENTE.nivelRiesgo}>
              {NOMBRE_NIVEL_RIESGO[alerta.nivelRiesgo]}
            </td>
            <td
              className={tabla['texto']}
              data-rotulo={ROTULOS_DOCENTE.justificacion}
            >
              {alerta.descripcion}
            </td>
            <td data-rotulo={ROTULOS_DOCENTE.estadoAtencion}>
              {NOMBRE_ESTADO[alerta.estadoAtencion]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
