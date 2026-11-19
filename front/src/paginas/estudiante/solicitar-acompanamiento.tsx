import { useState, type FormEvent } from 'react';
import { CampoTexto } from '../../componentes/campo-texto';
import { GrupoOpciones } from '../../componentes/grupo-opciones';
import { useLocation } from 'react-router';
import { formatearFecha } from '../../componentes/formato';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import { useEnvio } from '../../componentes/use-envio';
import {
  enviarConConciliacion,
  type PasosEnvio,
} from '../../servicios-api/conciliacion';
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
  ROTULOS_ESTUDIANTE,
  TEXTO_ASESORIA_EDUCATIVA,
  TEXTO_MOTIVO_VACIO,
  TEXTO_RESULTADO_INCIERTO,
  TEXTO_SOLICITUD_RECIBIDA,
  TITULOS_ESTUDIANTE,
} from './textos';
import { NOMBRE_ESTADO, NOMBRE_TIPO_APOYO } from '../../componentes/etiquetas';

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

/**
 * Pasos del envío con conciliación (sección i y ajuste C de F1): la lista de
 * solicitudes antes y después del envío dice si quedó registrada.
 */
function pasosSolicitud(datos: DatosSolicitud): PasosEnvio<Solicitud> {
  return {
    consultarPrevias: async () =>
      new Set(
        (await consultarSolicitudes()).map((solicitud) => solicitud.codigo),
      ),
    enviar: () => registrarSolicitud(datos),
    buscar: async (previas) =>
      buscarRegistrada(previas, await consultarSolicitudes(), datos),
  };
}

function SolicitarAcompanamiento() {
  const [tipoApoyo, setTipoApoyo] = useState<TipoApoyo | null>(null);
  const [motivo, setMotivo] = useState('');
  const [disponibilidad, setDisponibilidad] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<Solicitud | null>(null);
  // 401: ProveedorSesion ya llevó al inicio de sesión y el borrador no se
  // conserva (respuesta 5 de F1).
  const { enviando, enEspera, error, ponerError, ejecutar } = useEnvio();

  const terminar = (registrada: Solicitud) => {
    setComprobante(registrada);
    setTipoApoyo(null);
    setMotivo('');
    setDisponibilidad('');
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (tipoApoyo === null) {
      return;
    }
    if (motivo.trim() === '') {
      setErrorMotivo(TEXTO_MOTIVO_VACIO);
      return;
    }
    setErrorMotivo(null);
    const datos: DatosSolicitud = { tipoApoyo, motivo, disponibilidad };
    const resultado = await ejecutar(() =>
      enviarConConciliacion(pasosSolicitud(datos)),
    );
    if (resultado === undefined) {
      return;
    }
    if (resultado.tipo === 'incierto') {
      ponerError(TEXTO_RESULTADO_INCIERTO);
      return;
    }
    terminar(resultado.valor);
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
        <GrupoOpciones
          leyenda={ROTULOS_ESTUDIANTE.tipoApoyo}
          opciones={TIPOS}
          etiquetas={NOMBRE_TIPO_APOYO}
          valor={tipoApoyo}
          alCambiar={setTipoApoyo}
          clase={estilos['grupo']}
        />

        {/* Región viva siempre montada: el cambio de aviso se anuncia. */}
        <div aria-live="polite">
          {tipoApoyo !== null && (
            <div className={estilos['aviso']}>
              <p>{AVISO_QUIEN_VE[tipoApoyo]}</p>
              {tipoApoyo === 'ACADEMICA' && <p>{AVISO_REMISION_PSICOLOGIA}</p>}
            </div>
          )}
        </div>

        <CampoTexto
          rotulo={ROTULOS_ESTUDIANTE.motivo}
          valor={motivo}
          alCambiar={setMotivo}
          maximo={LIMITES.motivo}
          multilinea
          requerido
          error={errorMotivo}
          clase={estilos['campo']}
        />

        <CampoTexto
          rotulo={ROTULOS_ESTUDIANTE.disponibilidadOpcional}
          valor={disponibilidad}
          alCambiar={setDisponibilidad}
          maximo={LIMITES.disponibilidad}
          multilinea
          clase={estilos['campo']}
        />

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
