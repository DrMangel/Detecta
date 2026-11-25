import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import { Aviso } from '../../componentes/aviso';
import controles from '../../componentes/controles.module.css';
import { ROTULOS_COMUNES } from '../../componentes/etiquetas';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import { useEnvio } from '../../componentes/use-envio';
import {
  confirmarConsentimiento,
  consultarCasoPsicologo,
  type CasoPsicologo,
} from '../../servicios-api/psicologo';
import estilos from './psicologo.module.css';
import {
  ROTULOS_PSICOLOGO,
  TEXTO_CONSENTIMIENTO_CONFIRMADO,
  TEXTO_PREGUNTA_CONSENTIMIENTO,
  TEXTO_REQUIERE_CONSENTIMIENTO,
} from './textos';

/*
 * Confirmación del consentimiento informado (CUD09; IU_ConfirmacionConsentimiento
 * sobre IU_ResultadoAsesoria; especificación §7.6). Es el único diálogo del
 * sistema: un <dialog> nativo con showModal() (respuesta 10 de F5b-diseño),
 * que atrapa el foco y se cierra con Esc.
 *
 * - No se abre solo: lo abre el botón junto al aviso con lock (respuesta 4
 *   de D7).
 * - Al abrir, el foco pasa a la casilla. Con «Cancelar» o Esc vuelve al
 *   botón que lo abrió; el estado se sincroniza con el evento close y la
 *   casilla y el error se reinician (el contenido se desmonta al cerrar).
 * - Al confirmar con éxito, el diálogo se cierra y el expediente lleva el
 *   foco al mensaje de confirmación, porque el botón que lo abrió desaparece.
 * - Un error se muestra dentro del diálogo, que sigue abierto. Se conservan
 *   el POST sin cuerpo, la relectura del caso y el reintento (F4b).
 */
/**
 * Consentimiento del expediente: el aviso con el botón mientras falte y,
 * tras confirmarlo, el mensaje de confirmación con el foco, porque el botón
 * que abrió el diálogo ya no existe (§7.6; D7a).
 */
export function ConsentimientoDelCaso({
  caso,
  actualizar,
}: {
  caso: CasoPsicologo;
  actualizar: (caso: CasoPsicologo) => void;
}) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const confirmacion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mensaje !== null) confirmacion.current?.focus();
  }, [mensaje]);

  if (caso.requiereConsentimiento && !caso.consentimientoConfirmado) {
    return (
      <ConfirmacionConsentimiento
        idCaso={caso.idCaso}
        alConfirmar={(actual) => {
          actualizar(actual);
          setMensaje(TEXTO_CONSENTIMIENTO_CONFIRMADO);
        }}
      />
    );
  }
  if (mensaje === null) return null;
  return (
    <div ref={confirmacion} tabIndex={-1}>
      <MensajeInformativo mensaje={mensaje} />
    </div>
  );
}

function ConfirmacionConsentimiento({
  idCaso,
  alConfirmar,
}: {
  idCaso: string;
  alConfirmar: (caso: CasoPsicologo) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const abrir = useRef<HTMLButtonElement>(null);
  const confirmado = useRef(false);
  const [abierto, setAbierto] = useState(false);
  const idTitulo = useId();

  const alCerrar = () => {
    setAbierto(false);
    if (!confirmado.current) abrir.current?.focus();
  };
  const alConfirmarEnDialogo = (caso: CasoPsicologo) => {
    confirmado.current = true;
    dialogo.current?.close();
    alConfirmar(caso);
  };

  return (
    <div className={estilos['consentimiento']}>
      <Aviso icono="lock">
        <p>{TEXTO_REQUIERE_CONSENTIMIENTO}</p>
      </Aviso>
      <button
        ref={abrir}
        type="button"
        className={controles['boton-secundario']}
        onClick={() => setAbierto(true)}
      >
        {ROTULOS_PSICOLOGO.confirmarConsentimiento}
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        className={`${controles['tarjeta']} ${estilos['dialogo']}`}
        onClose={alCerrar}
      >
        {abierto && (
          <ContenidoDialogo
            idCaso={idCaso}
            idTitulo={idTitulo}
            dialogo={dialogo}
            alConfirmar={alConfirmarEnDialogo}
          />
        )}
      </dialog>
    </div>
  );
}

/** Formulario del diálogo; se monta al abrir y se desmonta al cerrar. */
function ContenidoDialogo({
  idCaso,
  idTitulo,
  dialogo,
  alConfirmar,
}: {
  idCaso: string;
  idTitulo: string;
  dialogo: RefObject<HTMLDialogElement | null>;
  alConfirmar: (caso: CasoPsicologo) => void;
}) {
  const casilla = useRef<HTMLInputElement>(null);
  const [afirmado, setAfirmado] = useState(false);
  const envio = useEnvio();

  // StrictMode repite el efecto: un diálogo ya abierto no se vuelve a abrir.
  useEffect(() => {
    const elemento = dialogo.current;
    if (elemento !== null && !elemento.hasAttribute('open')) {
      elemento.showModal();
    }
    casilla.current?.focus();
  }, [dialogo]);

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
    <form className={estilos['formulario-dialogo']} onSubmit={confirmar}>
      <h2 id={idTitulo}>{ROTULOS_PSICOLOGO.confirmarConsentimiento}</h2>
      <p>{TEXTO_REQUIERE_CONSENTIMIENTO}</p>
      <label className={controles['opcion']}>
        <input
          ref={casilla}
          type="checkbox"
          checked={afirmado}
          onChange={(evento) => setAfirmado(evento.target.checked)}
        />
        {TEXTO_PREGUNTA_CONSENTIMIENTO}
      </label>
      <MensajeError mensaje={envio.error} />
      <div className={estilos['acciones']}>
        <button
          type="submit"
          className={controles['boton']}
          disabled={!afirmado || envio.enviando || envio.enEspera}
        >
          {ROTULOS_PSICOLOGO.confirmarConsentimiento}
        </button>
        <button
          type="button"
          className={controles['boton-secundario']}
          onClick={() => dialogo.current?.close()}
        >
          {ROTULOS_COMUNES.cancelar}
        </button>
      </div>
    </form>
  );
}
