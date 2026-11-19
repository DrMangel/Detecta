import { useId, useState, type FormEvent } from 'react';
import { formatearFecha } from '../../componentes/formato';
import { MensajeError } from '../../componentes/mensaje-error';
import {
  consultarAlertasEmitidas,
  type AlertaEmitida,
} from '../../servicios-api/docente';
import { mensajeDeError } from '../../servicios-api/errores';
import { NOMBRE_ESTADO, NOMBRE_NIVEL_RIESGO } from '../estudiante/textos';
import estilos from './docente.module.css';
import { PlantillaDocente } from './plantilla-docente';
import {
  ROTULOS_DOCENTE,
  TEXTO_INDIQUE_PERIODO,
  TEXTO_SIN_ALERTAS_EMITIDAS,
  TITULOS_DOCENTE,
} from './textos';

/*
 * Alertas emitidas por el Docente (CUD01 2.c; sd_CUD01 `verAlertasEmitidas`
 * y `consultarAlertasEmitidas(periodo)`). Campo de periodo vacío, con la
 * ayuda «Por ejemplo: 2026-2» (respuesta 4 de F2). El estado de atención es
 * «Pendiente» o «Atendida», derivado del caso (D27): sin ruta, avance ni
 * resultado. Solo se pintan los campos conocidos de AlertaEmitida; nunca
 * motivos ni contenido de solicitudes (D18, D19).
 */

/** Máximo de leerPeriodo en el backend (curso.periodo varchar(20)). */
const LONGITUD_PERIODO = 20;

export function AlertasEmitidas() {
  const idPeriodo = useId();
  const idAyuda = useId();
  const idError = useId();
  const [periodo, setPeriodo] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<AlertaEmitida[] | null>(null);

  const consultar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (consultando) {
      return;
    }
    const buscado = periodo.trim();
    if (buscado === '') {
      setErrorPeriodo(TEXTO_INDIQUE_PERIODO);
      return;
    }
    setErrorPeriodo(null);
    setError(null);
    setConsultando(true);
    try {
      setAlertas(await consultarAlertasEmitidas(buscado));
    } catch (fallo) {
      // Un 401 ya llevó al inicio de sesión (ProveedorSesion).
      setAlertas(null);
      setError(mensajeDeError(fallo));
    } finally {
      setConsultando(false);
    }
  };

  return (
    <PlantillaDocente titulo={TITULOS_DOCENTE.alertasEmitidas}>
      <form className={estilos['formulario']} onSubmit={consultar} noValidate>
        <div className={estilos['campo']}>
          <label htmlFor={idPeriodo}>{ROTULOS_DOCENTE.periodo}</label>
          <input
            id={idPeriodo}
            type="text"
            value={periodo}
            maxLength={LONGITUD_PERIODO}
            required
            autoComplete="off"
            aria-invalid={errorPeriodo !== null}
            aria-describedby={
              errorPeriodo === null ? idAyuda : `${idAyuda} ${idError}`
            }
            onChange={(evento) => setPeriodo(evento.target.value)}
          />
          <p id={idAyuda} className={estilos['ayuda']}>
            {ROTULOS_DOCENTE.ayudaPeriodo}
          </p>
          <MensajeError mensaje={errorPeriodo} id={idError} />
        </div>
        <button
          type="submit"
          className={estilos['boton']}
          disabled={consultando}
        >
          {ROTULOS_DOCENTE.consultar}
        </button>
      </form>

      <MensajeError mensaje={error} />
      <div aria-busy={consultando}>
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
    <table className={estilos['tabla']}>
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
            <td
              className={estilos['numero']}
              data-rotulo={ROTULOS_DOCENTE.fecha}
            >
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
              className={estilos['texto']}
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
