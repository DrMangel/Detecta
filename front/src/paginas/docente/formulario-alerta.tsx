import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { formatearAsistencia, formatearNota } from '../../componentes/formato';
import { CampoTexto } from '../../componentes/campo-texto';
import { GrupoOpciones } from '../../componentes/grupo-opciones';
import { Icono } from '../../componentes/icono';
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
import controles from '../../componentes/controles.module.css';
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

interface PropsAlerta {
  curso: ConsultaCurso['curso'];
  registro: RegistroCurso;
  alEmitir: () => void;
}

/**
 * Estado y envío de la alerta (CUD03 pasos 6 a 8): la validación de 6.a, el
 * envío con conciliación y el resultado incierto. La vista solo lo pinta.
 */
function useEmisionAlerta({ curso, registro, alEmitir }: PropsAlerta) {
  const [nivelRiesgo, setNivelRiesgo] = useState<NivelRiesgo | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [errorCampos, setErrorCampos] = useState<string | null>(null);
  // 401: ProveedorSesion ya llevó al inicio de sesión; el borrador no se
  // conserva.
  const { enviando, error, ponerError, ejecutar } = useEnvio();

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

  return {
    nivelRiesgo,
    setNivelRiesgo,
    descripcion,
    setDescripcion,
    errorCampos,
    enviando,
    error,
    enviar,
  };
}

export function FormularioAlerta({
  curso,
  registro,
  alCerrar,
  alEmitir,
}: PropsAlerta & { alCerrar: () => void }) {
  const idTitulo = useId();
  const idErrorCampos = useId();
  const seccion = useRef<HTMLElement>(null);
  const alerta = useEmisionAlerta({ curso, registro, alEmitir });

  // Ajuste B: al abrir (o al cambiar de estudiante) el foco pasa al formulario.
  useEffect(() => {
    seccion.current?.focus();
  }, [registro.idRegistro]);

  const vacio = alerta.errorCampos !== null;

  return (
    <section
      ref={seccion}
      tabIndex={-1}
      aria-labelledby={idTitulo}
      className={`${controles['seccion']} ${controles['tarjeta']} ${estilos['destacada']}`}
    >
      <h2 id={idTitulo}>{ROTULOS_DOCENTE.emitirAlerta}</h2>
      <form
        className={estilos['panel']}
        onSubmit={(evento) => void alerta.enviar(evento)}
        noValidate
      >
        <DatosRegistro curso={curso} registro={registro} />

        <GrupoOpciones
          leyenda={ROTULOS_DOCENTE.nivelRiesgo}
          opciones={NIVELES}
          etiquetas={NOMBRE_NIVEL_RIESGO}
          valor={alerta.nivelRiesgo}
          alCambiar={alerta.setNivelRiesgo}
          invalido={vacio && alerta.nivelRiesgo === null}
        />

        <CampoTexto
          rotulo={ROTULOS_DOCENTE.justificacion}
          valor={alerta.descripcion}
          alCambiar={alerta.setDescripcion}
          maximo={LIMITES.descripcion}
          multilinea
          requerido
          contador
          invalido={vacio && alerta.descripcion.trim() === ''}
          descritoPor={vacio ? idErrorCampos : undefined}
          clase={estilos['campo']}
        />

        <MensajeError mensaje={alerta.errorCampos} id={idErrorCampos} enLinea />
        <MensajeError mensaje={alerta.error} />
        <div className={estilos['acciones']}>
          <button
            type="submit"
            className={controles['boton']}
            disabled={alerta.enviando}
          >
            <Icono nombre="send" tamano={18} />
            {ROTULOS_DOCENTE.emitirAlerta}
          </button>
          <button
            type="button"
            className={controles['boton-secundario']}
            disabled={alerta.enviando}
            onClick={alCerrar}
          >
            {ROTULOS_DOCENTE.cancelar}
          </button>
        </div>
      </form>
    </section>
  );
}

/** Bloque de solo lectura con el registro que sustenta la alerta (§7.3). */
function DatosRegistro({
  curso,
  registro,
}: Pick<PropsAlerta, 'curso' | 'registro'>) {
  return (
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
  );
}
