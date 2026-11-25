import { useId, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { CampoTexto } from '../../componentes/campo-texto';
import {
  NOMBRE_TIPO_APOYO,
  ROTULOS_COMUNES,
  ROTULOS_PERIODO,
} from '../../componentes/etiquetas';
import {
  formatearAsistencia,
  formatearFecha,
  formatearFechaHora,
  formatearNota,
} from '../../componentes/formato';
import { GrupoOpciones } from '../../componentes/grupo-opciones';
import { InsigniaRiesgo } from '../../componentes/insignias';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import controles from '../../componentes/controles.module.css';
import { EnlaceVolver } from '../../componentes/enlace-volver';
import { ParesDatos, type Dato } from '../../componentes/pares-datos';
import tabla from '../../componentes/tabla.module.css';
import { useConsulta } from '../../componentes/use-consulta';
import { useEnvio } from '../../componentes/use-envio';
import {
  buscarNueva,
  enviarConConciliacion,
  type PasosEnvio,
  type ResultadoEnvio,
} from '../../servicios-api/conciliacion';
import { ErrorApi } from '../../servicios-api/errores';
import { LIMITES } from '../../servicios-api/limites';
import {
  consultarCasoPsicologo,
  evaluarPertinencia,
  type Antecedente,
  type CasoPsicologo,
  type Cita,
  type DetallePsicologo,
  type Dictamen,
  type EstadoCaso,
} from '../../servicios-api/psicologo';
import { PlantillaPsicologo, RUTAS_PSICOLOGO } from './plantilla-psicologo';
import { ConsentimientoDelCaso } from './consentimiento';
import { OperacionesExpediente } from './operaciones';
import estilos from './psicologo.module.css';
import {
  MENSAJE_DICTAMEN_POR_ESTADO,
  NOMBRE_ESTADO_CASO,
  NOMBRE_ESTADO_CITA,
  NOMBRE_MODALIDAD,
  NOMBRE_ORIGEN_PSICOLOGO,
  NOMBRE_RUTA_PSICOLOGICA,
  NOMBRE_TIPO_ASESORIA,
  OPCION_DICTAMEN,
  ROTULOS_PSICOLOGO,
  TEXTO_JUSTIFICACION,
  TEXTO_RESULTADO_INCIERTO,
  TEXTO_SIN_ANTECEDENTES,
  TEXTO_VOLVER_REMISIONES,
  TITULOS_PSICOLOGO,
} from './textos';

type Decision = keyof typeof OPCION_DICTAMEN;
type EstadoDictamen = 'EN_EVALUACION' | 'ARCHIVADO' | 'REORIENTADO';

const DECISIONES: readonly Decision[] = ['APROBAR', 'ARCHIVAR', 'REORIENTAR'];

const ESTADO_POR_DECISION: Readonly<Record<Decision, EstadoDictamen>> = {
  APROBAR: 'EN_EVALUACION',
  ARCHIVAR: 'ARCHIVADO',
  REORIENTAR: 'REORIENTADO',
};

function esEstadoDictamen(estado: EstadoCaso): estado is EstadoDictamen {
  return Object.hasOwn(MENSAJE_DICTAMEN_POR_ESTADO, estado);
}

export function PaginaExpedientePsicologo() {
  const { idCaso = '' } = useParams();
  return <DetalleDelCaso key={idCaso} idCaso={idCaso} />;
}

function DetalleDelCaso({ idCaso }: { idCaso: string }) {
  const { datos, error } = useConsulta(
    () => consultarCasoPsicologo(idCaso),
    idCaso,
  );
  return (
    <PlantillaPsicologo
      titulo={TITULOS_PSICOLOGO.expediente}
      volver={
        <EnlaceVolver a={RUTAS_PSICOLOGO.remisiones}>
          {TEXTO_VOLVER_REMISIONES}
        </EnlaceVolver>
      }
    >
      <MensajeError mensaje={error} />
      <div aria-busy={datos === null && error === null}>
        {datos !== null && (
          <ContenidoExpediente detalle={datos} idCaso={idCaso} />
        )}
      </div>
    </PlantillaPsicologo>
  );
}

function ContenidoExpediente({
  detalle,
  idCaso,
}: {
  detalle: DetallePsicologo;
  idCaso: string;
}) {
  const [caso, setCaso] = useState(detalle.caso);
  const [dictamenHecho, setDictamenHecho] = useState(
    detalle.caso.psicologo !== null,
  );
  const [mensajeDictamen, setMensajeDictamen] = useState<string | null>(null);
  const relectura = useEnvio();
  // POST /pertinencia solo devuelve {estado, mensaje}: sin releer, el caso
  // seguiría sin psicólogo y «Programar primera cita» no aparecería hasta
  // recargar (F5b, defecto 1). Si la relectura falla, el dictamen ya quedó.
  const alDictaminar = async (mensaje: string) => {
    setDictamenHecho(true);
    setMensajeDictamen(mensaje);
    const actual = await relectura.ejecutar(() =>
      consultarCasoPsicologo(idCaso),
    );
    if (actual !== undefined) setCaso(actual.caso);
  };
  return (
    <>
      <DatosExpediente caso={caso} />
      <Antecedentes antecedentes={detalle.antecedentes} />
      <ConsentimientoDelCaso caso={caso} actualizar={setCaso} />
      <Citas citas={caso.citas} />
      {caso.psicologo !== null && (
        <OperacionesExpediente
          idCaso={idCaso}
          caso={caso}
          actualizar={setCaso}
        />
      )}
      {caso.psicologo === null && !dictamenHecho && (
        <Evaluacion
          idCaso={idCaso}
          alCompletar={(mensaje) => void alDictaminar(mensaje)}
        />
      )}
      <MensajeInformativo mensaje={mensajeDictamen} />
      <MensajeError mensaje={relectura.error} />
      {dictamenHecho && caso.psicologo !== null && (
        <MensajeInformativo mensaje={NOMBRE_ESTADO_CASO[caso.estado]} />
      )}
    </>
  );
}

/** Tarjeta de sección del expediente (§7.5; maquetas 10 y 11). */
const TARJETA_SECCION = `${controles['seccion']} ${controles['tarjeta']} ${estilos['bloque']}`;

const siNo = (valor: boolean) => (valor ? 'Sí' : 'No');

/** Datos del caso en el orden de la §7.5; los mismos que antes de D7a. */
function datosCaso(caso: CasoPsicologo): Dato[] {
  const datos: Dato[] = [
    { rotulo: ROTULOS_COMUNES.estudiante, valor: caso.estudiante.nombre },
    {
      rotulo: ROTULOS_COMUNES.fecha,
      valor: formatearFecha(caso.fechaCreacion),
    },
    { rotulo: ROTULOS_COMUNES.estado, valor: NOMBRE_ESTADO_CASO[caso.estado] },
    {
      rotulo: ROTULOS_PSICOLOGO.ruta,
      valor: caso.ruta === null ? '' : NOMBRE_RUTA_PSICOLOGICA[caso.ruta],
    },
    {
      rotulo: ROTULOS_PSICOLOGO.riesgoCritico,
      valor: siNo(caso.presentaRiesgoCritico),
    },
  ];
  if (caso.nivelRiesgo !== null) {
    datos.push({
      rotulo: ROTULOS_COMUNES.nivelRiesgo,
      valor: <InsigniaRiesgo nivel={caso.nivelRiesgo} />,
    });
  }
  if (caso.psicologo !== null) {
    datos.push({
      rotulo: ROTULOS_PSICOLOGO.psicologo,
      valor: caso.psicologo.nombre,
    });
  }
  const consentimiento = valorConsentimiento(caso);
  if (consentimiento !== null) {
    datos.push({
      rotulo: ROTULOS_PSICOLOGO.consentimiento,
      valor: consentimiento,
    });
  }
  return datos;
}

/**
 * Un solo valor de consentimiento (R06: casilla «Sí/No», si aplica): la
 * confirmación gana a «requiere»; si no aplica (mayor de edad), ninguno.
 */
function valorConsentimiento(caso: CasoPsicologo): string | null {
  if (caso.consentimientoConfirmado) return 'Sí';
  if (caso.requiereConsentimiento) return 'No';
  return null;
}

/** Datos propios del origen; los textos libres, a ancho completo. */
function datosOrigen(origen: CasoPsicologo['origen']): Dato[] {
  if (origen.tipo === 'ALERTA') {
    return [
      {
        rotulo: ROTULOS_PSICOLOGO.origen,
        valor: NOMBRE_ORIGEN_PSICOLOGO.ALERTA,
      },
      { rotulo: ROTULOS_COMUNES.curso, valor: origen.curso.nombre },
      { rotulo: ROTULOS_PERIODO.periodo, valor: origen.curso.periodo },
      {
        rotulo: ROTULOS_COMUNES.nota,
        valor: formatearNota(origen.registro.nota),
      },
      {
        rotulo: ROTULOS_COMUNES.asistencia,
        valor: formatearAsistencia(origen.registro.porcentajeAsistencia),
      },
      {
        rotulo: ROTULOS_COMUNES.justificacion,
        valor: origen.descripcion,
        ancho: true,
      },
    ];
  }
  const datos: Dato[] = [
    {
      rotulo: ROTULOS_PSICOLOGO.origen,
      valor: NOMBRE_ORIGEN_PSICOLOGO.SOLICITUD,
    },
    {
      rotulo: ROTULOS_COMUNES.tipoApoyo,
      valor: NOMBRE_TIPO_APOYO[origen.tipoApoyo],
    },
  ];
  if (origen.motivo !== undefined) {
    datos.push({
      rotulo: ROTULOS_COMUNES.motivo,
      valor: origen.motivo,
      ancho: true,
    });
  }
  if (origen.disponibilidad !== undefined && origen.disponibilidad !== '') {
    datos.push({
      rotulo: ROTULOS_COMUNES.disponibilidad,
      valor: origen.disponibilidad,
      ancho: true,
    });
  }
  return datos;
}

function DatosExpediente({ caso }: { caso: CasoPsicologo }) {
  return (
    <div className={`${controles['tarjeta']} ${estilos['bloque']}`}>
      <ParesDatos datos={[...datosCaso(caso), ...datosOrigen(caso.origen)]} />
    </div>
  );
}

function Antecedentes({
  antecedentes,
}: {
  antecedentes: readonly Antecedente[];
}) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo} className={TARJETA_SECCION}>
      <h2 id={idTitulo}>{ROTULOS_PSICOLOGO.antecedentes}</h2>
      {antecedentes.length === 0 ? (
        <p>{TEXTO_SIN_ANTECEDENTES}</p>
      ) : (
        <div className={tabla['contenedor']}>
          <table className={`${tabla['tabla']} ${tabla['comoda']}`}>
            <thead>
              <tr>
                <th scope="col">{ROTULOS_COMUNES.curso}</th>
                <th scope="col">{ROTULOS_PERIODO.periodo}</th>
                <th scope="col">{ROTULOS_COMUNES.nota}</th>
                <th scope="col">{ROTULOS_COMUNES.asistencia}</th>
                <th scope="col">{ROTULOS_COMUNES.ultimaSincronizacion}</th>
              </tr>
            </thead>
            <tbody>
              {antecedentes.map((registro, indice) => (
                <tr key={indice}>
                  <th scope="row">{registro.curso.nombre}</th>
                  <td data-rotulo={ROTULOS_PERIODO.periodo}>
                    {registro.curso.periodo}
                  </td>
                  <td data-rotulo={ROTULOS_COMUNES.nota}>
                    {formatearNota(registro.nota)}
                  </td>
                  <td data-rotulo={ROTULOS_COMUNES.asistencia}>
                    {formatearAsistencia(registro.porcentajeAsistencia)}
                  </td>
                  <td data-rotulo={ROTULOS_COMUNES.ultimaSincronizacion}>
                    {registro.ultimaSincronizacion === null
                      ? TEXTO_SIN_ANTECEDENTES
                      : formatearFechaHora(registro.ultimaSincronizacion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Modalidad y estado; con resultado, también la asesoría (F4b). */
function datosCita(cita: Cita): Dato[] {
  const datos: Dato[] = [
    {
      rotulo: ROTULOS_PSICOLOGO.modalidad,
      valor: NOMBRE_MODALIDAD[cita.modalidad],
    },
    { rotulo: ROTULOS_COMUNES.estado, valor: NOMBRE_ESTADO_CITA[cita.estado] },
  ];
  const asesoria = cita.asesoria;
  if (asesoria === null) return datos;
  return [
    ...datos,
    {
      rotulo: ROTULOS_PSICOLOGO.tipoAsesoria,
      valor: NOMBRE_TIPO_ASESORIA[asesoria.tipoAsesoria],
    },
    { rotulo: ROTULOS_PSICOLOGO.asistencia, valor: siNo(asesoria.asistencia) },
    {
      rotulo: ROTULOS_PSICOLOGO.seguimiento,
      valor: siNo(asesoria.requiereSeguimiento),
    },
    {
      rotulo: ROTULOS_PSICOLOGO.riesgoCritico,
      valor: siNo(asesoria.presentaRiesgoCritico),
    },
    {
      rotulo: ROTULOS_PSICOLOGO.observaciones,
      valor: asesoria.observaciones,
      ancho: true,
    },
    {
      rotulo: ROTULOS_PSICOLOGO.acuerdos,
      valor: asesoria.acuerdos,
      ancho: true,
    },
  ];
}

function Citas({ citas }: { citas: readonly Cita[] }) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo} className={controles['seccion']}>
      <h2 id={idTitulo}>{ROTULOS_PSICOLOGO.citas}</h2>
      <div className={estilos['citas']}>
        {citas.map((cita, indice) => (
          <article
            key={indice}
            className={`${controles['tarjeta']} ${estilos['cita']}`}
          >
            <h3>{formatearFechaHora(cita.fechaHora)}</h3>
            <ParesDatos datos={datosCita(cita)} columnas={3} />
          </article>
        ))}
      </div>
    </section>
  );
}

function firmaCaso(caso: CasoPsicologo): string {
  return [caso.estado, caso.psicologo?.id ?? '', caso.justificacion].join('|');
}

function coincideDictamen(
  caso: CasoPsicologo,
  decision: Decision,
  justificacion: string,
): boolean {
  if (caso.estado !== ESTADO_POR_DECISION[decision]) return false;
  if (decision === 'APROBAR') return caso.psicologo !== null;
  return caso.justificacion === justificacion;
}

function pasosDictamen(
  idCaso: string,
  decision: Decision,
  justificacion: string,
): PasosEnvio<Dictamen> {
  return {
    consultarPrevias: async () => {
      const anterior = await consultarCasoPsicologo(idCaso);
      return new Set([firmaCaso(anterior.caso)]);
    },
    enviar: () =>
      evaluarPertinencia({
        idCaso,
        pertinente: decision === 'APROBAR',
        justificacion,
        ...(decision === 'APROBAR'
          ? {}
          : { reorientar: decision === 'REORIENTAR' }),
      }),
    buscar: async (previas) => {
      const actual = await consultarCasoPsicologo(idCaso);
      const nuevo = buscarNueva(previas, [actual.caso], {
        clave: firmaCaso,
        coincide: (caso) => coincideDictamen(caso, decision, justificacion),
      });
      if (nuevo === null) return null;
      if (!esEstadoDictamen(nuevo.estado)) return null;
      return {
        estado: nuevo.estado,
        mensaje: MENSAJE_DICTAMEN_POR_ESTADO[nuevo.estado],
      };
    },
  };
}

function textoResultado(resultado: Dictamen): string {
  if (esEstadoDictamen(resultado.estado)) {
    return MENSAJE_DICTAMEN_POR_ESTADO[resultado.estado];
  }
  return resultado.mensaje;
}

function Evaluacion({
  idCaso,
  alCompletar,
}: {
  idCaso: string;
  alCompletar: (mensaje: string) => void;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [justificacion, setJustificacion] = useState('');
  const [errorJustificacion, setErrorJustificacion] = useState<string | null>(
    null,
  );
  const [incierto, setIncierto] = useState(false);
  const { enviando, enEspera, error, ponerError, ejecutar } = useEnvio();

  const evaluar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (decision === null) return;
    if (justificacion.trim() === '') {
      setErrorJustificacion(TEXTO_JUSTIFICACION);
      return;
    }
    setErrorJustificacion(null);
    const resultado = await ejecutar(async () => {
      try {
        return await enviarConConciliacion(
          pasosDictamen(idCaso, decision, justificacion),
        );
      } catch (fallo) {
        if (fallo instanceof ErrorApi && fallo.estado === null) {
          return { tipo: 'incierto' } as ResultadoEnvio<Dictamen>;
        }
        throw fallo;
      }
    });
    if (resultado === undefined) return;
    if (resultado.tipo === 'incierto') {
      setIncierto(true);
      ponerError(TEXTO_RESULTADO_INCIERTO);
      return;
    }
    ponerError(null);
    alCompletar(textoResultado(resultado.valor));
    setDecision(null);
    setErrorJustificacion(null);
  };
  return (
    <section className={TARJETA_SECCION}>
      <h2>{ROTULOS_PSICOLOGO.dictamen}</h2>
      <form className={controles['formulario']} onSubmit={evaluar} noValidate>
        <GrupoOpciones
          leyenda={ROTULOS_PSICOLOGO.dictamen}
          opciones={DECISIONES}
          etiquetas={OPCION_DICTAMEN}
          valor={decision}
          alCambiar={setDecision}
        />
        <CampoTexto
          rotulo={ROTULOS_PSICOLOGO.justificacion}
          valor={justificacion}
          alCambiar={(valor) => {
            setJustificacion(valor);
            setErrorJustificacion(null);
          }}
          maximo={LIMITES.descripcion}
          multilinea
          requerido
          error={errorJustificacion}
        />
        <MensajeError mensaje={error} />
        <button
          type="submit"
          className={controles['boton']}
          disabled={decision === null || enviando || enEspera || incierto}
        >
          {ROTULOS_PSICOLOGO.dictamen}
        </button>
      </form>
    </section>
  );
}
