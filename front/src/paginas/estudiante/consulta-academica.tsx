import { useId, useState, type FormEvent } from 'react';
import { useEsperaReintento } from '../../componentes/espera-reintento';
import {
  formatearAsistencia,
  formatearFecha,
  formatearNota,
} from '../../componentes/formato';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import { ErrorApi, mensajeDeError } from '../../servicios-api/errores';
import {
  consultarAlertas,
  consultarRegistros,
  type AlertaEstudiante,
  type RegistrosEstudiante,
} from '../../servicios-api/estudiante';
import { LIMITES } from '../../servicios-api/limites';
import estilos from './estudiante.module.css';
import { PlantillaEstudiante } from './plantilla-estudiante';
import {
  ROTULOS_ESTUDIANTE,
  TEXTO_SIN_ALERTAS,
  TITULOS_ESTUDIANTE,
} from './textos';
import {
  NOMBRE_NIVEL_RIESGO,
  TEXTO_INDIQUE_PERIODO,
  TEXTO_INFORMACION_NO_DISPONIBLE,
} from '../../componentes/etiquetas';

/*
 * Consulta académica del Estudiante (CUD01; sd_CUD01, rama del estudiante).
 * El estudiante escribe el periodo (texto libre de hasta 20 caracteres, como
 * lo valida el backend) y ve sus notas, su asistencia y la fecha de la
 * última sincronización de cada curso, más las alertas emitidas sobre él en
 * el periodo (2.a). Sin registros, el backend responde «Información no
 * disponible» (4.a); el front no asume ningún valor (ER 3.3.1).
 *
 * Los datos viven solo en el estado del componente (nada en el navegador).
 */

interface Resultado {
  periodo: string;
  registros: RegistrosEstudiante;
  alertas: AlertaEstudiante[];
}

export function ConsultaAcademica() {
  const idPeriodo = useId();
  const idAyuda = useId();
  const idError = useId();
  const [periodo, setPeriodo] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const { enEspera, esperar } = useEsperaReintento();

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
      const [registros, alertas] = await Promise.all([
        consultarRegistros(buscado),
        consultarAlertas(buscado),
      ]);
      setResultado({ periodo: buscado, registros, alertas });
    } catch (fallo) {
      // Un 401 ya llevó al inicio de sesión (ProveedorSesion).
      setResultado(null);
      setError(mensajeDeError(fallo));
      if (fallo instanceof ErrorApi && fallo.estado === 429) {
        esperar(fallo.esperaSegundos);
      }
    } finally {
      setConsultando(false);
    }
  };

  return (
    <PlantillaEstudiante titulo={TITULOS_ESTUDIANTE.consulta}>
      <form className={estilos['formulario']} onSubmit={consultar} noValidate>
        <div className={estilos['campo']}>
          <label htmlFor={idPeriodo}>{ROTULOS_ESTUDIANTE.periodo}</label>
          <input
            id={idPeriodo}
            type="text"
            value={periodo}
            maxLength={LIMITES.periodo}
            required
            autoComplete="off"
            aria-invalid={errorPeriodo !== null}
            aria-describedby={
              errorPeriodo === null ? idAyuda : `${idAyuda} ${idError}`
            }
            onChange={(evento) => setPeriodo(evento.target.value)}
          />
          <p id={idAyuda} className={estilos['ayuda']}>
            {ROTULOS_ESTUDIANTE.ayudaPeriodo}
          </p>
          <MensajeError mensaje={errorPeriodo} id={idError} />
        </div>
        <button
          type="submit"
          className={estilos['boton']}
          disabled={consultando || enEspera}
        >
          {ROTULOS_ESTUDIANTE.consultar}
        </button>
      </form>

      <MensajeError mensaje={error} />
      <div aria-busy={consultando}>
        {resultado !== null && <ResultadoConsulta resultado={resultado} />}
      </div>
    </PlantillaEstudiante>
  );
}

function ResultadoConsulta({ resultado }: { resultado: Resultado }) {
  const { registros } = resultado.registros;
  const { alertas } = resultado;
  return (
    <>
      <section className={estilos['seccion']}>
        {registros.length === 0 ? (
          <MensajeInformativo
            mensaje={
              resultado.registros.mensaje ?? TEXTO_INFORMACION_NO_DISPONIBLE
            }
          />
        ) : (
          <ul className={estilos['lista']}>
            {registros.map((registro) => (
              <li key={registro.idRegistro} className={estilos['tarjeta']}>
                <dl className={estilos['datos']}>
                  <dt>{ROTULOS_ESTUDIANTE.asignatura}</dt>
                  <dd>{registro.curso.nombre}</dd>
                  <dt>{ROTULOS_ESTUDIANTE.nota}</dt>
                  <dd>{formatearNota(registro.nota)}</dd>
                  <dt>{ROTULOS_ESTUDIANTE.asistencia}</dt>
                  <dd>{formatearAsistencia(registro.porcentajeAsistencia)}</dd>
                  <dt>{ROTULOS_ESTUDIANTE.ultimaSincronizacion}</dt>
                  <dd>
                    {registro.ultimaSincronizacion === null
                      ? TEXTO_INFORMACION_NO_DISPONIBLE
                      : formatearFecha(registro.ultimaSincronizacion)}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={estilos['seccion']}>
        <h2>{ROTULOS_ESTUDIANTE.alertas}</h2>
        {alertas.length === 0 ? (
          <p>{TEXTO_SIN_ALERTAS}</p>
        ) : (
          <ul className={estilos['lista']}>
            {alertas.map((alerta) => (
              <li key={alerta.idAlerta} className={estilos['tarjeta']}>
                <dl className={estilos['datos']}>
                  <dt>{ROTULOS_ESTUDIANTE.fecha}</dt>
                  <dd>{formatearFecha(alerta.fecha)}</dd>
                  <dt>{ROTULOS_ESTUDIANTE.asignatura}</dt>
                  <dd>{alerta.curso}</dd>
                  <dt>{ROTULOS_ESTUDIANTE.nivelRiesgo}</dt>
                  <dd>{NOMBRE_NIVEL_RIESGO[alerta.nivelRiesgo]}</dd>
                  <dt>{ROTULOS_ESTUDIANTE.descripcion}</dt>
                  <dd>{alerta.descripcion}</dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
