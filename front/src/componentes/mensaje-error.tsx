import { Icono, type NombreIcono } from './icono';
import estilos from './mensajes.module.css';

/*
 * Mensajes uniformes (F0; con ícono en F5b-diseño, especificación §4).
 * role="alert" y role="status" los anuncian a los lectores de pantalla
 * (accesibilidad base); el ícono es decorativo. MensajeError es el mismo
 * para 401, 403, 409, 429, 503, 500 y error de red.
 */
export function MensajeError({
  mensaje,
  id,
}: {
  mensaje: string | null;
  /** Para asociarlo a un campo con aria-describedby (F1, CUD02 5.a). */
  id?: string;
}) {
  if (mensaje === null) {
    return null;
  }
  return (
    <p role="alert" id={id} className={estilos['error']}>
      <Icono nombre="triangle-alert" />
      <span>{mensaje}</span>
    </p>
  );
}

/**
 * Tipos de mensaje con role="status" (§4): una confirmación (check, verde)
 * o un aviso informativo (info, tinte azul).
 */
export type TipoMensaje = 'confirmacion' | 'informativo';

const ICONO_MENSAJE: Readonly<Record<TipoMensaje, NombreIcono>> = {
  confirmacion: 'check',
  informativo: 'info',
};

/** Mensaje con role="status" (por ejemplo, el 202 de solicitar-activacion). */
export function MensajeInformativo({
  mensaje,
  tipo = 'confirmacion',
}: {
  mensaje: string | null;
  tipo?: TipoMensaje;
}) {
  if (mensaje === null) {
    return null;
  }
  return (
    <p role="status" className={estilos[tipo]}>
      <Icono nombre={ICONO_MENSAJE[tipo]} />
      <span>{mensaje}</span>
    </p>
  );
}
