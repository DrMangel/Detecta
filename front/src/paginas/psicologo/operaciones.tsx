import { useState, type FormEvent } from 'react';
import { CampoTexto } from '../../componentes/campo-texto';
import controles from '../../componentes/controles.module.css';
import { MensajeError } from '../../componentes/mensaje-error';
import { useEnvio } from '../../componentes/use-envio';
import { LIMITES } from '../../servicios-api/limites';
import { ErrorApi } from '../../servicios-api/errores';
import {
  consultarCasoPsicologo,
  cerrarCaso,
  programarPrimeraCita,
  programarSeguimiento,
  reprogramarCita,
  registrarResultado,
  type CasoPsicologo,
  type Cita,
  type Modalidad,
  type TipoAsesoria,
} from '../../servicios-api/psicologo';

const TZ = 'America/Bogota';
const modalidades: readonly Modalidad[] = ['PRESENCIAL', 'VIRTUAL'];
const nombresModalidad: Record<Modalidad, string> = {
  PRESENCIAL: 'Presencial',
  VIRTUAL: 'Virtual',
};
const tipos: readonly TipoAsesoria[] = ['ORIENTACION', 'SEGUIMIENTO'];
const nombresTipo: Record<TipoAsesoria, string> = {
  ORIENTACION: 'Orientación',
  SEGUIMIENTO: 'Seguimiento',
};

/*
 * Valores por defecto de los formularios (F5b, Commit 3). Los formularios
 * comparten estado, así que cada operación exitosa reinicia solo sus campos:
 * programar, reprogramar o seguir una cita reinician CITA_POR_DEFECTO;
 * registrar un resultado reinicia RESULTADO_POR_DEFECTO. Así la cita
 * siguiente no hereda lo escrito para la anterior y un borrador de otro
 * formulario se conserva. Tras un error no se reinicia nada.
 */
const CITA_POR_DEFECTO = { fecha: '', modalidad: 'PRESENCIAL' } as const;
const RESULTADO_POR_DEFECTO = {
  tipo: 'ORIENTACION',
  observaciones: '',
  acuerdos: '',
  asistencia: 'true',
  requiereSeguimiento: false,
  riesgo: false,
} as const;

function isoBogota(valor: string): string {
  return `${valor}:00-05:00`;
}

export function OperacionesExpediente({
  idCaso,
  caso,
  actualizar,
}: {
  idCaso: string;
  caso: CasoPsicologo;
  actualizar: (caso: CasoPsicologo) => void;
}) {
  const envio = useEnvio();
  const [fecha, setFecha] = useState<string>(CITA_POR_DEFECTO.fecha);
  const [modalidad, setModalidad] = useState<Modalidad>(
    CITA_POR_DEFECTO.modalidad,
  );
  const [tipo, setTipo] = useState<TipoAsesoria>(RESULTADO_POR_DEFECTO.tipo);
  const [observaciones, setObservaciones] = useState<string>(
    RESULTADO_POR_DEFECTO.observaciones,
  );
  const [acuerdos, setAcuerdos] = useState<string>(
    RESULTADO_POR_DEFECTO.acuerdos,
  );
  const [asistencia, setAsistencia] = useState<string>(
    RESULTADO_POR_DEFECTO.asistencia,
  );
  const [requiereSeguimiento, setRequiereSeguimiento] = useState<boolean>(
    RESULTADO_POR_DEFECTO.requiereSeguimiento,
  );
  const [riesgo, setRiesgo] = useState<boolean>(RESULTADO_POR_DEFECTO.riesgo);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [reintentoBloqueado, setReintentoBloqueado] = useState(false);
  const limpiarCita = () => {
    setFecha(CITA_POR_DEFECTO.fecha);
    setModalidad(CITA_POR_DEFECTO.modalidad);
  };
  const limpiarResultado = () => {
    setTipo(RESULTADO_POR_DEFECTO.tipo);
    setObservaciones(RESULTADO_POR_DEFECTO.observaciones);
    setAcuerdos(RESULTADO_POR_DEFECTO.acuerdos);
    setAsistencia(RESULTADO_POR_DEFECTO.asistencia);
    setRequiereSeguimiento(RESULTADO_POR_DEFECTO.requiereSeguimiento);
    setRiesgo(RESULTADO_POR_DEFECTO.riesgo);
  };
  const refrescar = async () => {
    const detalle = await consultarCasoPsicologo(idCaso);
    actualizar(detalle.caso);
  };
  // `limpiar` corre solo si la acción no lanzó: un error conserva lo escrito.
  const enviar = (accion: () => Promise<unknown>, limpiar?: () => void) =>
    void envio.ejecutar(async () => {
      try {
        const respuesta = await accion();
        limpiar?.();
        await refrescar();
        return respuesta;
      } catch (error) {
        if (error instanceof ErrorApi && error.estado === null) {
          setReintentoBloqueado(true);
        }
        throw error;
      }
    });
  const cita = (cuerpo: { fechaHora: string; modalidad: Modalidad }) => ({
    fechaHora: isoBogota(cuerpo.fechaHora),
    modalidad: cuerpo.modalidad,
  });
  const registrar = (
    evento: FormEvent,
    accion: () => Promise<unknown>,
    limpiar: () => void,
  ) => {
    evento.preventDefault();
    setMensaje(null);
    enviar(accion, limpiar);
  };
  const ultima = [...caso.citas]
    .sort((a, b) => Date.parse(a.fechaHora) - Date.parse(b.fechaHora))
    .at(-1);
  const esFinal =
    caso.estado === 'CERRADO' ||
    caso.estado === 'ARCHIVADO' ||
    caso.estado === 'REORIENTADO';
  const requiereConsentimiento =
    caso.requiereConsentimiento && !caso.consentimientoConfirmado;
  const cierreCompleto =
    ultima?.asesoria !== null &&
    ultima?.asesoria !== undefined &&
    ultima.asesoria.observaciones.trim() !== '';
  const formato = (valor: string) =>
    new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: TZ,
    }).format(new Date(valor));
  return (
    <section className={controles['seccion']}>
      <h2>Atención y seguimiento</h2>
      <p>Las fechas se interpretan en America/Bogota (UTC-5).</p>
      <MensajeError mensaje={envio.error} />
      {reintentoBloqueado && (
        <p role="status">
          No se pudo confirmar la operación. Consulte de nuevo el expediente
          antes de reintentar.
        </p>
      )}
      {caso.estado === 'EN_EVALUACION' && caso.citas.length === 0 && (
        <form
          className={controles['formulario']}
          onSubmit={(e) =>
            registrar(
              e,
              () =>
                programarPrimeraCita(
                  idCaso,
                  cita({ fechaHora: fecha, modalidad }),
                ),
              limpiarCita,
            )
          }
        >
          <h3>Programar primera cita</h3>
          <label>
            Fecha y hora (Bogotá)
            <input
              type="datetime-local"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <label>
            Modalidad
            <select
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value as Modalidad)}
            >
              {modalidades.map((v) => (
                <option key={v} value={v}>
                  {nombresModalidad[v]}
                </option>
              ))}
            </select>
          </label>
          <button
            className={controles['boton']}
            disabled={reintentoBloqueado || envio.enviando || envio.enEspera}
          >
            Programar cita
          </button>
        </form>
      )}
      {caso.citas.map((c: Cita) => (
        <article key={c.idCita} className={controles['seccion']}>
          <h3>
            Cita: {formato(c.fechaHora)} · {nombresModalidad[c.modalidad]}
          </h3>
          {!esFinal && (
            <form
              className={controles['formulario']}
              onSubmit={(e) =>
                registrar(
                  e,
                  () =>
                    reprogramarCita(
                      c.idCita,
                      cita({ fechaHora: fecha, modalidad }),
                    ),
                  limpiarCita,
                )
              }
            >
              <label>
                Nueva fecha y hora (Bogotá)
                <input
                  type="datetime-local"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </label>
              <label>
                Modalidad
                <select
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value as Modalidad)}
                >
                  {modalidades.map((v) => (
                    <option key={v} value={v}>
                      {nombresModalidad[v]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={controles['boton']}
                disabled={
                  reintentoBloqueado || envio.enviando || envio.enEspera
                }
              >
                Reprogramar
              </button>
            </form>
          )}
          {c.asesoria === null && !esFinal && (
            <form
              className={controles['formulario']}
              onSubmit={(e) =>
                registrar(
                  e,
                  () =>
                    registrarResultado(idCaso, c.idCita, {
                      tipo,
                      observaciones,
                      acuerdos,
                      asistencia: asistencia === 'true',
                      requiereSeguimiento,
                      presentaRiesgoCritico: riesgo,
                    }),
                  limpiarResultado,
                )
              }
            >
              <h3>Registrar resultado</h3>
              {requiereConsentimiento && (
                <p>
                  Confirme el consentimiento informado antes de registrar
                  asesoría o resultado.
                </p>
              )}
              <label>
                Tipo
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoAsesoria)}
                >
                  {tipos.map((v) => (
                    <option key={v} value={v}>
                      {nombresTipo[v]}
                    </option>
                  ))}
                </select>
              </label>
              <CampoTexto
                rotulo="Observaciones"
                valor={observaciones}
                alCambiar={setObservaciones}
                maximo={LIMITES.descripcion}
                multilinea
                requerido
              />
              <CampoTexto
                rotulo="Acuerdos"
                valor={acuerdos}
                alCambiar={setAcuerdos}
                maximo={LIMITES.descripcion}
                multilinea
              />
              <label>
                Asistencia
                <select
                  value={asistencia}
                  onChange={(e) => setAsistencia(e.target.value)}
                >
                  <option value="true">Asistió</option>
                  <option value="false">No asistió</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={requiereSeguimiento}
                  onChange={(e) => setRequiereSeguimiento(e.target.checked)}
                />
                Requiere seguimiento
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={riesgo}
                  onChange={(e) => setRiesgo(e.target.checked)}
                />
                Presenta riesgo crítico
              </label>
              <button
                className={controles['boton']}
                disabled={
                  requiereConsentimiento ||
                  envio.enviando ||
                  envio.enEspera ||
                  reintentoBloqueado
                }
              >
                Registrar resultado
              </button>
            </form>
          )}
        </article>
      ))}
      {!esFinal && ultima?.asesoria?.requiereSeguimiento && (
        <form
          className={controles['formulario']}
          onSubmit={(e) =>
            registrar(
              e,
              () =>
                programarSeguimiento(
                  idCaso,
                  cita({ fechaHora: fecha, modalidad }),
                ),
              limpiarCita,
            )
          }
        >
          <h3>Programar seguimiento</h3>
          <label>
            Fecha y hora (Bogotá)
            <input
              type="datetime-local"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <label>
            Modalidad
            <select
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value as Modalidad)}
            >
              {modalidades.map((v) => (
                <option key={v} value={v}>
                  {nombresModalidad[v]}
                </option>
              ))}
            </select>
          </label>
          <button
            className={controles['boton']}
            disabled={reintentoBloqueado || envio.enviando || envio.enEspera}
          >
            Programar seguimiento
          </button>
        </form>
      )}
      {!esFinal && (
        <div>
          <button
            type="button"
            className={controles['boton']}
            disabled={
              reintentoBloqueado ||
              !cierreCompleto ||
              envio.enviando ||
              envio.enEspera
            }
            onClick={() =>
              enviar(async () => {
                const r = await cerrarCaso(idCaso);
                setMensaje(r.mensaje);
                return r;
              })
            }
          >
            Cerrar caso
          </button>
        </div>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
    </section>
  );
}
