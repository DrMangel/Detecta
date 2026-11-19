import { useId, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { useEsperaReintento } from '../../componentes/espera-reintento';
import { formatearFecha } from '../../componentes/formato';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import {
  ErrorApi,
  mensajeDeError,
  TEXTO_ERROR_RED,
} from '../../servicios-api/errores';
import {
  consultarSolicitudes,
  registrarSolicitud,
  type DatosSolicitud,
  type Solicitud,
  type TipoApoyo,
} from '../../servicios-api/estudiante';
import { LIMITES } from '../../servicios-api/limites';
import { buscarRegistrada } from './conciliacion';
import estilos from './estudiante.module.css';
import { PlantillaEstudiante } from './plantilla-estudiante';
import {
  AVISO_QUIEN_VE,
  AVISO_REMISION_PSICOLOGIA,
  NOMBRE_ESTADO,
  NOMBRE_TIPO_APOYO,
  ROTULOS_ESTUDIANTE,
  TEXTO_ASESORIA_EDUCATIVA,
  TEXTO_MOTIVO_VACIO,
  TEXTO_RESULTADO_INCIERTO,
  TEXTO_SOLICITUD_RECIBIDA,
  TITULOS_ESTUDIANTE,
} from './textos';

/*
 * Solicitar acompañamiento voluntario (CUD02; R02; sd_CUD02).
 *
 * - Paso 2: tipo de apoyo sin valor por defecto; sin tipo no se puede enviar.
 * - Paso 3 (R02): al elegir el tipo y antes del envío, el aviso de quién
 *   podrá ver la solicitud; junto a él, el carácter de asesoría educativa
 *   (ER 1.3.4).
 * - 5.a: motivo vacío → «Describa el motivo de la solicitud» junto al campo,
 *   sin enviar. La disponibilidad es opcional (B6, ajuste C).
 * - 6.a (R02): con un 503 no se registró nada; lo escrito se conserva en el
 *   estado del componente (sd_CUD02: «La GUI conserva los datos
 *   diligenciados»). Solo en memoria, nunca en el almacenamiento del
 *   navegador (plan de F1, sección h): se pierde al recargar, al salir de la
 *   pantalla o tras un 401 (respuesta 5).
 * - Paso 7: el 201 reemplaza el formulario por el comprobante, con el código
 *   de rastreo y sin datos de identidad (ER 3.3.3).
 * - Doble envío: botón deshabilitado mientras se envía y conciliación tras un
 *   error de red (conciliacion.ts; sección i y ajuste C).
 */

const TIPOS: readonly TipoApoyo[] = ['ACADEMICA', 'PSICOLOGICA'];

/**
 * Cada navegación a la pantalla (también desde el enlace estando en ella,
 * tras el comprobante) monta un formulario nuevo y vacío.
 */
export function PaginaSolicitarAcompanamiento() {
  const { key } = useLocation();
  return <SolicitarAcompanamiento key={key} />;
}

function esSesionVencida(fallo: unknown): boolean {
  return fallo instanceof ErrorApi && fallo.estado === 401;
}

function SolicitarAcompanamiento() {
  const nombreTipo = useId();
  const idMotivo = useId();
  const idErrorMotivo = useId();
  const idDisponibilidad = useId();
  const [tipoApoyo, setTipoApoyo] = useState<TipoApoyo | null>(null);
  const [motivo, setMotivo] = useState('');
  const [disponibilidad, setDisponibilidad] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [comprobante, setComprobante] = useState<Solicitud | null>(null);
  const { enEspera, esperar } = useEsperaReintento();
  // Cierra la ventana entre dos clics antes de que React vuelva a pintar.
  const enCurso = useRef(false);

  const terminar = (registrada: Solicitud) => {
    setComprobante(registrada);
    setTipoApoyo(null);
    setMotivo('');
    setDisponibilidad('');
  };

  /** Códigos ya registrados; null si no se pudo consultar (no bloquea). */
  const codigosPrevios = async (): Promise<Set<string> | null> => {
    try {
      const lista = await consultarSolicitudes();
      return new Set(lista.map((solicitud) => solicitud.codigo));
    } catch (fallo) {
      if (esSesionVencida(fallo)) {
        throw fallo;
      }
      return null;
    }
  };

  /** Tras un error de red: ¿quedó registrada? */
  const conciliar = async (
    previos: Set<string> | null,
    datos: DatosSolicitud,
  ) => {
    if (previos === null) {
      setError(TEXTO_RESULTADO_INCIERTO);
      return;
    }
    try {
      const registrada = buscarRegistrada(
        previos,
        await consultarSolicitudes(),
        datos,
      );
      if (registrada === null) {
        setError(TEXTO_ERROR_RED);
      } else {
        terminar(registrada);
      }
    } catch (fallo) {
      if (!esSesionVencida(fallo)) {
        setError(TEXTO_RESULTADO_INCIERTO);
      }
    }
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enCurso.current || tipoApoyo === null) {
      return;
    }
    if (motivo.trim() === '') {
      setErrorMotivo(TEXTO_MOTIVO_VACIO);
      return;
    }
    setErrorMotivo(null);
    setError(null);
    enCurso.current = true;
    setEnviando(true);
    const datos: DatosSolicitud = { tipoApoyo, motivo, disponibilidad };
    try {
      const previos = await codigosPrevios();
      try {
        terminar(await registrarSolicitud(datos));
      } catch (fallo) {
        if (fallo instanceof ErrorApi && fallo.estado === null) {
          await conciliar(previos, datos);
        } else if (!esSesionVencida(fallo)) {
          setError(mensajeDeError(fallo));
          if (fallo instanceof ErrorApi && fallo.estado === 429) {
            esperar(fallo.esperaSegundos);
          }
        }
      }
    } catch {
      // 401 en la consulta previa: ProveedorSesion ya llevó al inicio de
      // sesión y el borrador no se conserva (respuesta 5).
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  if (comprobante !== null) {
    return (
      <PlantillaEstudiante titulo={TITULOS_ESTUDIANTE.nuevaSolicitud}>
        <div className={estilos['comprobante']}>
          <MensajeInformativo mensaje={TEXTO_SOLICITUD_RECIBIDA} />
          <dl className={`${estilos['datos']} ${estilos['tarjeta']}`}>
            <dt>{ROTULOS_ESTUDIANTE.codigo}</dt>
            <dd>{comprobante.codigo}</dd>
            <dt>{ROTULOS_ESTUDIANTE.fecha}</dt>
            <dd>{formatearFecha(comprobante.fecha)}</dd>
            <dt>{ROTULOS_ESTUDIANTE.estado}</dt>
            <dd>{NOMBRE_ESTADO[comprobante.estado]}</dd>
          </dl>
        </div>
      </PlantillaEstudiante>
    );
  }

  return (
    <PlantillaEstudiante titulo={TITULOS_ESTUDIANTE.nuevaSolicitud}>
      <p className={estilos['caracter']}>{TEXTO_ASESORIA_EDUCATIVA}</p>
      <form className={estilos['formulario']} onSubmit={enviar} noValidate>
        <fieldset className={estilos['grupo']}>
          <legend>{ROTULOS_ESTUDIANTE.tipoApoyo}</legend>
          {TIPOS.map((tipo) => (
            <label key={tipo} className={estilos['opcion']}>
              <input
                type="radio"
                name={nombreTipo}
                value={tipo}
                checked={tipoApoyo === tipo}
                onChange={() => setTipoApoyo(tipo)}
              />
              {NOMBRE_TIPO_APOYO[tipo]}
            </label>
          ))}
        </fieldset>

        {/* Región viva siempre montada: el cambio de aviso se anuncia. */}
        <div aria-live="polite">
          {tipoApoyo !== null && (
            <div className={estilos['aviso']}>
              <p>{AVISO_QUIEN_VE[tipoApoyo]}</p>
              {tipoApoyo === 'ACADEMICA' && <p>{AVISO_REMISION_PSICOLOGIA}</p>}
            </div>
          )}
        </div>

        <div className={estilos['campo']}>
          <label htmlFor={idMotivo}>{ROTULOS_ESTUDIANTE.motivo}</label>
          <textarea
            id={idMotivo}
            value={motivo}
            maxLength={LIMITES.motivo}
            required
            autoComplete="off"
            aria-invalid={errorMotivo !== null}
            aria-describedby={errorMotivo === null ? undefined : idErrorMotivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
          <MensajeError mensaje={errorMotivo} id={idErrorMotivo} />
        </div>

        <div className={estilos['campo']}>
          <label htmlFor={idDisponibilidad}>
            {ROTULOS_ESTUDIANTE.disponibilidadOpcional}
          </label>
          <textarea
            id={idDisponibilidad}
            value={disponibilidad}
            maxLength={LIMITES.disponibilidad}
            autoComplete="off"
            onChange={(evento) => setDisponibilidad(evento.target.value)}
          />
        </div>

        <MensajeError mensaje={error} />
        <button
          type="submit"
          className={estilos['boton']}
          disabled={tipoApoyo === null || enviando || enEspera}
        >
          {ROTULOS_ESTUDIANTE.enviar}
        </button>
      </form>
    </PlantillaEstudiante>
  );
}
