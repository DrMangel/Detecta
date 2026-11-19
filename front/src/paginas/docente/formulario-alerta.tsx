import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { formatearAsistencia, formatearNota } from '../../componentes/formato';
import { CampoTexto } from '../../componentes/campo-texto';
import { GrupoOpciones } from '../../componentes/grupo-opciones';
import { MensajeError } from '../../componentes/mensaje-error';
import { useEnvio } from '../../componentes/use-envio';
import {
  enviarConConciliacion,
  type PasosEnvio,
} from '../../servicios-api/conciliacion';
import {
  consultarAlertasEmitidas,
  emitirAlerta,
  type AlertaEmitida,
  type ConsultaCurso,
  type DatosAlerta,
  type RegistroCurso,
} from '../../servicios-api/docente';
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

/**
 * Pasos del envío con conciliación (§5 del plan de F2): la lista de alertas
 * emitidas en el periodo del curso, antes y después, dice si quedó registrada.
 */
function pasosAlerta(
  periodo: string,
  datos: DatosAlerta,
  enviada: AlertaEnviada,
): PasosEnvio<AlertaEmitida> {
  return {
    consultarPrevias: async () =>
      new Set(
        (await consultarAlertasEmitidas(periodo)).map(
          (alerta) => alerta.idAlerta,
        ),
      ),
    enviar: async () => (await emitirAlerta(datos)).alerta,
    buscar: async (previas) =>
      buscarAlertaRegistrada(
        previas,
        await consultarAlertasEmitidas(periodo),
        enviada,
      ),
  };
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
  const idErrorCampos = useId();
  const seccion = useRef<HTMLElement>(null);
  const [nivelRiesgo, setNivelRiesgo] = useState<NivelRiesgo | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [errorCampos, setErrorCampos] = useState<string | null>(null);
  // 401: ProveedorSesion ya llevó al inicio de sesión; el borrador no se
  // conserva.
  const { enviando, error, ponerError, ejecutar } = useEnvio();

  // Ajuste B: al abrir (o al cambiar de estudiante) el foco pasa al formulario.
  useEffect(() => {
    seccion.current?.focus();
  }, [registro.idRegistro]);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (nivelRiesgo === null || descripcion.trim() === '') {
      setErrorCampos(TEXTO_CAMPOS_VACIOS);
      return;
    }
    setErrorCampos(null);
    const datos = { idRegistro: registro.idRegistro, nivelRiesgo, descripcion };
    const enviada: AlertaEnviada = {
      idCurso: curso.idCurso,
      idEstudiante: registro.estudiante.id,
      nivelRiesgo,
      descripcion,
    };
    const resultado = await ejecutar(() =>
      enviarConConciliacion(pasosAlerta(curso.periodo, datos, enviada)),
    );
    if (resultado === undefined) {
      return;
    }
    if (resultado.tipo === 'incierto') {
      ponerError(TEXTO_ALERTA_INCIERTA);
      return;
    }
    alEmitir();
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

        <GrupoOpciones
          leyenda={ROTULOS_DOCENTE.nivelRiesgo}
          opciones={NIVELES}
          etiquetas={NOMBRE_NIVEL_RIESGO}
          valor={nivelRiesgo}
          alCambiar={setNivelRiesgo}
          invalido={vacio && nivelRiesgo === null}
          clase={estilos['grupo']}
        />

        <CampoTexto
          rotulo={ROTULOS_DOCENTE.justificacion}
          valor={descripcion}
          alCambiar={setDescripcion}
          maximo={LIMITES.descripcion}
          multilinea
          requerido
          contador
          invalido={vacio && descripcion.trim() === ''}
          descritoPor={vacio ? idErrorCampos : undefined}
          clase={estilos['campo']}
        />

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
