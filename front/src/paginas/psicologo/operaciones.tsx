import { useState, type FormEvent } from 'react';
import { CampoTexto } from '../../componentes/campo-texto';
import controles from '../../componentes/controles.module.css';
import { MensajeError } from '../../componentes/mensaje-error';
import { useEnvio } from '../../componentes/use-envio';
import { LIMITES } from '../../servicios-api/limites';
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
  const [fecha, setFecha] = useState('');
  const [modalidad, setModalidad] = useState<Modalidad>('PRESENCIAL');
  const [tipo, setTipo] = useState<TipoAsesoria>('ORIENTACION');
  const [observaciones, setObservaciones] = useState('');
  const [acuerdos, setAcuerdos] = useState('');
  const [asistencia, setAsistencia] = useState('true');
  const [requiereSeguimiento, setRequiereSeguimiento] = useState(false);
  const [riesgo, setRiesgo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const refrescar = async () => {
    const detalle = await consultarCasoPsicologo(idCaso);
    actualizar(detalle.caso);
  };
  const enviar = (accion: () => Promise<unknown>) =>
    void envio.ejecutar(async () => {
      const respuesta = await accion();
      await refrescar();
      return respuesta;
    });
  const cita = (cuerpo: { fechaHora: string; modalidad: Modalidad }) => ({
    fechaHora: isoBogota(cuerpo.fechaHora),
    modalidad: cuerpo.modalidad,
  });
  const registrar = (evento: FormEvent, accion: () => Promise<unknown>) => {
    evento.preventDefault();
    setMensaje(null);
    enviar(accion);
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
      {caso.estado === 'EN_EVALUACION' && caso.citas.length === 0 && (
        <form
          className={controles['formulario']}
          onSubmit={(e) =>
            registrar(e, () =>
              programarPrimeraCita(
                idCaso,
                cita({ fechaHora: fecha, modalidad }),
              ),
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
            disabled={envio.enviando || envio.enEspera}
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
                registrar(e, () =>
                  reprogramarCita(
                    c.idCita,
                    cita({ fechaHora: fecha, modalidad }),
                  ),
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
                disabled={envio.enviando || envio.enEspera}
              >
                Reprogramar
              </button>
            </form>
          )}
          {c.asesoria === null && !esFinal && (
            <form
              className={controles['formulario']}
              onSubmit={(e) =>
                registrar(e, () =>
                  registrarResultado(idCaso, c.idCita, {
                    tipo,
                    observaciones,
                    acuerdos,
                    asistencia: asistencia === 'true',
                    requiereSeguimiento,
                    presentaRiesgoCritico: riesgo,
                  }),
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
                  requiereConsentimiento || envio.enviando || envio.enEspera
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
            registrar(e, () =>
              programarSeguimiento(
                idCaso,
                cita({ fechaHora: fecha, modalidad }),
              ),
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
            disabled={envio.enviando || envio.enEspera}
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
            disabled={!cierreCompleto || envio.enviando || envio.enEspera}
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
          {mensaje && <p role="status">{mensaje}</p>}
        </div>
      )}
    </section>
  );
}
