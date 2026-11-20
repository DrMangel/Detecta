import { useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { CampoTexto } from '../../componentes/campo-texto';
import {
  NOMBRE_NIVEL_RIESGO,
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
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import controles from '../../componentes/controles.module.css';
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
  confirmarConsentimiento,
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
  TEXTO_CONSENTIMIENTO_CONFIRMADO,
  TEXTO_JUSTIFICACION,
  TEXTO_REQUIERE_CONSENTIMIENTO,
  TEXTO_RESULTADO_INCIERTO,
  TEXTO_SIN_ANTECEDENTES,
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
    <PlantillaPsicologo titulo={TITULOS_PSICOLOGO.expediente}>
      <Link to={RUTAS_PSICOLOGO.remisiones} className={estilos['volver']}>
        {TITULOS_PSICOLOGO.remisiones}
      </Link>
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
  const [mensajeConsentimiento, setMensajeConsentimiento] = useState<
    string | null
  >(null);
  return (
    <>
      <DatosCaso caso={caso} />
      <DatosOrigen caso={caso} />
      <Antecedentes antecedentes={detalle.antecedentes} />
      <Citas citas={caso.citas} />
      {caso.psicologo !== null && (
        <OperacionesExpediente
          idCaso={idCaso}
          caso={caso}
          actualizar={setCaso}
        />
      )}
      {caso.requiereConsentimiento && !caso.consentimientoConfirmado && (
        <Consentimiento
          idCaso={idCaso}
          alConfirmar={(actual) => {
            setCaso(actual);
            setMensajeConsentimiento(TEXTO_CONSENTIMIENTO_CONFIRMADO);
          }}
        />
      )}
      <MensajeInformativo mensaje={mensajeConsentimiento} />
      {caso.psicologo === null && !dictamenHecho && (
        <Evaluacion
          idCaso={idCaso}
          alCompletar={(mensaje) => {
            setDictamenHecho(true);
            setMensajeDictamen(mensaje);
          }}
        />
      )}
      <MensajeInformativo mensaje={mensajeDictamen} />
      {dictamenHecho && caso.psicologo !== null && (
        <MensajeInformativo mensaje={NOMBRE_ESTADO_CASO[caso.estado]} />
      )}
    </>
  );
}

type Fila = readonly [rotulo: string, valor: string];

function DatosCaso({ caso }: { caso: CasoPsicologo }) {
  const filas: Fila[] = [
    [ROTULOS_COMUNES.estudiante, caso.estudiante.nombre],
    [ROTULOS_COMUNES.fecha, formatearFecha(caso.fechaCreacion)],
    [ROTULOS_COMUNES.estado, NOMBRE_ESTADO_CASO[caso.estado]],
    [
      ROTULOS_PSICOLOGO.ruta,
      caso.ruta === null ? '' : NOMBRE_RUTA_PSICOLOGICA[caso.ruta],
    ],
    [ROTULOS_PSICOLOGO.riesgoCritico, caso.presentaRiesgoCritico ? 'Sí' : 'No'],
  ];
  if (caso.nivelRiesgo !== null) {
    filas.push([
      ROTULOS_COMUNES.nivelRiesgo,
      NOMBRE_NIVEL_RIESGO[caso.nivelRiesgo],
    ]);
  }
  if (caso.psicologo !== null) {
    filas.push([ROTULOS_PSICOLOGO.psicologo, caso.psicologo.nombre]);
  }
  if (caso.consentimientoConfirmado) {
    filas.push([ROTULOS_PSICOLOGO.consentimiento, 'Sí']);
  }
  if (caso.requiereConsentimiento) {
    filas.push([ROTULOS_PSICOLOGO.consentimiento, 'No']);
  }
  return <ListaDatos filas={filas} />;
}

function DatosOrigen({ caso }: { caso: CasoPsicologo }) {
  const origen = caso.origen;
  if (origen.tipo === 'ALERTA') {
    return (
      <ListaDatos
        filas={[
          [ROTULOS_PSICOLOGO.origen, NOMBRE_ORIGEN_PSICOLOGO.ALERTA],
          [ROTULOS_COMUNES.curso, origen.curso.nombre],
          [ROTULOS_PERIODO.periodo, origen.curso.periodo],
          [ROTULOS_COMUNES.justificacion, origen.descripcion],
          [ROTULOS_COMUNES.nota, formatearNota(origen.registro.nota)],
          [
            ROTULOS_COMUNES.asistencia,
            formatearAsistencia(origen.registro.porcentajeAsistencia),
          ],
        ]}
      />
    );
  }
  const filas: Fila[] = [
    [ROTULOS_PSICOLOGO.origen, NOMBRE_ORIGEN_PSICOLOGO.SOLICITUD],
    [ROTULOS_COMUNES.tipoApoyo, NOMBRE_TIPO_APOYO[origen.tipoApoyo]],
  ];
  if (origen.motivo !== undefined) {
    filas.push([ROTULOS_COMUNES.motivo, origen.motivo]);
  }
  if (origen.disponibilidad !== undefined && origen.disponibilidad !== '') {
    filas.push([ROTULOS_COMUNES.disponibilidad, origen.disponibilidad]);
  }
  return <ListaDatos filas={filas} />;
}

function ListaDatos({ filas }: { filas: readonly Fila[] }) {
  return (
    <dl className={estilos['datos']}>
      {filas.map(([rotulo, valor], indice) => (
        <div key={indice}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Antecedentes({
  antecedentes,
}: {
  antecedentes: readonly Antecedente[];
}) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo} className={controles['seccion']}>
      <h2 id={idTitulo}>{ROTULOS_PSICOLOGO.antecedentes}</h2>
      {antecedentes.length === 0 ? (
        <p>{TEXTO_SIN_ANTECEDENTES}</p>
      ) : (
        <table className={tabla['tabla']}>
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
      )}
    </section>
  );
}

function Citas({ citas }: { citas: readonly Cita[] }) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo} className={controles['seccion']}>
      <h2 id={idTitulo}>{ROTULOS_PSICOLOGO.citas}</h2>
      {citas.map((cita, indice) => (
        <article key={indice} className={estilos['cita']}>
          <h3>{formatearFechaHora(cita.fechaHora)}</h3>
          <ListaDatos
            filas={[
              [ROTULOS_PSICOLOGO.modalidad, NOMBRE_MODALIDAD[cita.modalidad]],
              [ROTULOS_COMUNES.estado, NOMBRE_ESTADO_CITA[cita.estado]],
            ]}
          />
          {cita.asesoria !== null && (
            <ListaDatos
              filas={[
                [
                  ROTULOS_PSICOLOGO.tipoAsesoria,
                  NOMBRE_TIPO_ASESORIA[cita.asesoria.tipoAsesoria],
                ],
                [ROTULOS_PSICOLOGO.observaciones, cita.asesoria.observaciones],
                [ROTULOS_PSICOLOGO.acuerdos, cita.asesoria.acuerdos],
                [
                  ROTULOS_PSICOLOGO.asistencia,
                  cita.asesoria.asistencia ? 'Sí' : 'No',
                ],
                [
                  ROTULOS_PSICOLOGO.seguimiento,
                  cita.asesoria.requiereSeguimiento ? 'Sí' : 'No',
                ],
                [
                  ROTULOS_PSICOLOGO.riesgoCritico,
                  cita.asesoria.presentaRiesgoCritico ? 'Sí' : 'No',
                ],
              ]}
            />
          )}
        </article>
      ))}
    </section>
  );
}

function Consentimiento({
  idCaso,
  alConfirmar,
}: {
  idCaso: string;
  alConfirmar: (caso: CasoPsicologo) => void;
}) {
  const [afirmado, setAfirmado] = useState(false);
  const envio = useEnvio();
  const confirmar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!afirmado) return;
    const actual = await envio.ejecutar(async () => {
      await confirmarConsentimiento(idCaso);
      return consultarCasoPsicologo(idCaso);
    });
    if (actual === undefined) return;
    alConfirmar(actual.caso);
  };
  return (
    <form
      className={`${controles['formulario']} ${controles['seccion']}`}
      onSubmit={confirmar}
    >
      <h2>{ROTULOS_PSICOLOGO.confirmarConsentimiento}</h2>
      <p>{TEXTO_REQUIERE_CONSENTIMIENTO}</p>
      <label className={controles['opcion']}>
        <input
          type="checkbox"
          checked={afirmado}
          onChange={(evento) => setAfirmado(evento.target.checked)}
        />
        ¿El acudiente otorgó el consentimiento informado?
      </label>
      <MensajeError mensaje={envio.error} />
      <button
        type="submit"
        className={controles['boton']}
        disabled={!afirmado || envio.enviando || envio.enEspera}
      >
        {ROTULOS_PSICOLOGO.confirmarConsentimiento}
      </button>
    </form>
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
    <section className={controles['seccion']}>
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
