import { useState } from 'react';
import { FormularioPeriodo } from '../../componentes/formulario-periodo';
import {
  formatearAsistencia,
  formatearFecha,
  formatearNota,
} from '../../componentes/formato';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import { useEnvio } from '../../componentes/use-envio';
import {
  consultarAlertas,
  consultarRegistros,
  type AlertaEstudiante,
  type RegistrosEstudiante,
} from '../../servicios-api/estudiante';
import controles from '../../componentes/controles.module.css';
import estilos from './estudiante.module.css';
import { PlantillaEstudiante } from './plantilla-estudiante';
import {
  ROTULOS_ESTUDIANTE,
  TEXTO_SIN_ALERTAS,
  TITULOS_ESTUDIANTE,
} from './textos';
import {
  NOMBRE_NIVEL_RIESGO,
  TEXTO_INFORMACION_NO_DISPONIBLE,
} from '../../componentes/etiquetas';

/*
 * Consulta académica del Estudiante (CUD01; sd_CUD01, rama del estudiante).
 * El estudiante escribe el periodo (FormularioPeriodo) y ve sus notas, su asistencia y la fecha de la
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
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const consultar = async (periodo: string) => {
    const datos = await ejecutar(() =>
      Promise.all([consultarRegistros(periodo), consultarAlertas(periodo)]),
    );
    // Si falla, el error queda a la vista y no se muestra el resultado anterior.
    setResultado(
      datos === undefined
        ? null
        : { periodo, registros: datos[0], alertas: datos[1] },
    );
  };

  return (
    <PlantillaEstudiante titulo={TITULOS_ESTUDIANTE.consulta}>
      <FormularioPeriodo
        alConsultar={(periodo) => void consultar(periodo)}
        ocupado={enviando || enEspera}
        claseCampo={estilos['campo']}
      />

      <MensajeError mensaje={error} />
      <div aria-busy={enviando}>
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
      <section className={controles['seccion']}>
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

      <section className={controles['seccion']}>
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
