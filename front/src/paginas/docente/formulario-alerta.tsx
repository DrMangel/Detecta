import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { formatearAsistencia, formatearNota } from '../../componentes/formato';
import { MensajeError } from '../../componentes/mensaje-error';
import {
  consultarAlertasEmitidas,
  emitirAlerta,
  type ConsultaCurso,
  type RegistroCurso,
} from '../../servicios-api/docente';
import {
  ErrorApi,
  mensajeDeError,
  TEXTO_ERROR_RED,
} from '../../servicios-api/errores';
import type { NivelRiesgo } from '../../servicios-api/estudiante';
import { LIMITES } from '../../servicios-api/limites';
import {
  buscarAlertaRegistrada,
  type AlertaEnviada,
} from './conciliacion-alerta';
import estilos from './docente.module.css';
import {
  ROTULOS_DOCENTE,
  TEXTO_ALERTA_INCIERTA,
  TEXTO_CAMPOS_VACIOS,
  textoContador,
} from './textos';
import { NOMBRE_NIVEL_RIESGO } from '../../componentes/etiquetas';

/*
 * Formulario de alerta temprana (CUD03 pasos 4 a 8; R01; sd_CUD03).
 *
 * - Muestra el estudiante y el registro académico que sustenta la alerta
 *   (plan del front, F2; Manual CUD03: «asociada a un registro académico
 *   válido»).
 * - Nivel de riesgo sin valor por defecto (ajuste A). Justificación de hasta
 *   2000 caracteres (LONGITUD_MAXIMA.descripcion), con contador y sin
 *   autocompletado.
 * - 6.a: nivel o justificación vacíos → «Complete el nivel de riesgo y la
 *   justificación», sin enviar (R01: «bloquea el envío notificando la
 *   omisión»).
 * - Al abrirse, el foco pasa al formulario (ajuste B); el componente padre lo
 *   devuelve al botón que lo abrió al cerrarse o tras la confirmación.
 * - Doble envío: botón deshabilitado durante el envío y conciliación tras un
 *   error de red (conciliacion-alerta.ts).
 * - Lo escrito vive solo en memoria: se conserva ante un 503 o un error de
 *   red; se pierde al cerrar, al salir o tras un 401 (como en F1).
 */

const NIVELES: readonly NivelRiesgo[] = ['BAJO', 'MEDIO', 'ALTO'];

function esSesionVencida(fallo: unknown): boolean {
  return fallo instanceof ErrorApi && fallo.estado === 401;
}

export function FormularioAlerta({
  curso,
  registro,
  alCerrar,
  alEmitir,
}: {
  curso: ConsultaCurso['curso'];
  registro: RegistroCurso;
  alCerrar: () => void;
  alEmitir: () => void;
}) {
  const idTitulo = useId();
  const nombreNivel = useId();
  const idJustificacion = useId();
  const idContador = useId();
  const idErrorCampos = useId();
  const seccion = useRef<HTMLElement>(null);
  const enCurso = useRef(false);
  const [nivelRiesgo, setNivelRiesgo] = useState<NivelRiesgo | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [errorCampos, setErrorCampos] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Ajuste B: al abrir (o al cambiar de estudiante) el foco pasa al formulario.
  useEffect(() => {
    seccion.current?.focus();
  }, [registro.idRegistro]);

  /** idAlerta ya emitidas en el periodo; null si no se pudo consultar. */
  const alertasPrevias = async (): Promise<Set<string> | null> => {
    try {
      const lista = await consultarAlertasEmitidas(curso.periodo);
      return new Set(lista.map((alerta) => alerta.idAlerta));
    } catch (fallo) {
      if (esSesionVencida(fallo)) {
        throw fallo;
      }
      return null;
    }
  };

  const conciliar = async (
    previas: Set<string> | null,
    enviada: AlertaEnviada,
  ) => {
    if (previas === null) {
      setError(TEXTO_ALERTA_INCIERTA);
      return;
    }
    try {
      const registrada = buscarAlertaRegistrada(
        previas,
        await consultarAlertasEmitidas(curso.periodo),
        enviada,
      );
      if (registrada === null) {
        setError(TEXTO_ERROR_RED);
      } else {
        alEmitir();
      }
    } catch (fallo) {
      if (!esSesionVencida(fallo)) {
        setError(TEXTO_ALERTA_INCIERTA);
      }
    }
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enCurso.current) {
      return;
    }
    if (nivelRiesgo === null || descripcion.trim() === '') {
      setErrorCampos(TEXTO_CAMPOS_VACIOS);
      return;
    }
    setErrorCampos(null);
    setError(null);
    enCurso.current = true;
    setEnviando(true);
    const enviada: AlertaEnviada = {
      idCurso: curso.idCurso,
      idEstudiante: registro.estudiante.id,
      nivelRiesgo,
      descripcion,
    };
    try {
      const previas = await alertasPrevias();
      try {
        await emitirAlerta({
          idRegistro: registro.idRegistro,
          nivelRiesgo,
          descripcion,
        });
        alEmitir();
      } catch (fallo) {
        if (fallo instanceof ErrorApi && fallo.estado === null) {
          await conciliar(previas, enviada);
        } else if (!esSesionVencida(fallo)) {
          setError(mensajeDeError(fallo));
        }
      }
    } catch {
      // 401 en la consulta previa: ProveedorSesion ya llevó al inicio de
      // sesión; el borrador no se conserva.
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  const vacio = errorCampos !== null;

  return (
    <section
      ref={seccion}
      tabIndex={-1}
      aria-labelledby={idTitulo}
      className={estilos['seccion']}
    >
      <h2 id={idTitulo}>{ROTULOS_DOCENTE.emitirAlerta}</h2>
      <form className={estilos['panel']} onSubmit={enviar} noValidate>
        <dl className={estilos['registro']}>
          <dt>{ROTULOS_DOCENTE.estudiante}</dt>
          <dd>{registro.estudiante.nombre}</dd>
          <dt>{ROTULOS_DOCENTE.curso}</dt>
          <dd>{curso.nombre}</dd>
          <dt>{ROTULOS_DOCENTE.nota}</dt>
          <dd>{formatearNota(registro.nota)}</dd>
          <dt>{ROTULOS_DOCENTE.asistencia}</dt>
          <dd>{formatearAsistencia(registro.porcentajeAsistencia)}</dd>
        </dl>

        <fieldset
          className={estilos['grupo']}
          aria-invalid={vacio && nivelRiesgo === null}
        >
          <legend>{ROTULOS_DOCENTE.nivelRiesgo}</legend>
          {NIVELES.map((nivel) => (
            <label key={nivel} className={estilos['opcion']}>
              <input
                type="radio"
                name={nombreNivel}
                value={nivel}
                checked={nivelRiesgo === nivel}
                onChange={() => setNivelRiesgo(nivel)}
              />
              {NOMBRE_NIVEL_RIESGO[nivel]}
            </label>
          ))}
        </fieldset>

        <div className={estilos['campo']}>
          <label htmlFor={idJustificacion}>
            {ROTULOS_DOCENTE.justificacion}
          </label>
          <textarea
            id={idJustificacion}
            value={descripcion}
            maxLength={LIMITES.descripcion}
            required
            autoComplete="off"
            aria-invalid={vacio && descripcion.trim() === ''}
            aria-describedby={
              vacio ? `${idContador} ${idErrorCampos}` : idContador
            }
            onChange={(evento) => setDescripcion(evento.target.value)}
          />
          <p id={idContador} className={estilos['ayuda']}>
            {textoContador(descripcion.length, LIMITES.descripcion)}
          </p>
        </div>

        <MensajeError mensaje={errorCampos} id={idErrorCampos} />
        <MensajeError mensaje={error} />
        <div className={estilos['acciones']}>
          <button
            type="submit"
            className={estilos['boton']}
            disabled={enviando}
          >
            {ROTULOS_DOCENTE.emitirAlerta}
          </button>
          <button
            type="button"
            className={estilos['botonSecundario']}
            disabled={enviando}
            onClick={alCerrar}
          >
            {ROTULOS_DOCENTE.cancelar}
          </button>
        </div>
      </form>
    </section>
  );
}
