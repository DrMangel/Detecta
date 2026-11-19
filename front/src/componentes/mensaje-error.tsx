import estilos from './formulario.module.css';

/*
 * Mensaje de error uniforme (F0). role="alert" lo anuncia a los lectores de
 * pantalla (accesibilidad base). Siempre el mismo componente para 401, 403,
 * 409, 429, 503, 500 y error de red.
 */
export function MensajeError({ mensaje }: { mensaje: string | null }) {
  if (mensaje === null) {
    return null;
  }
  return (
    <p role="alert" className={estilos['error']}>
      {mensaje}
    </p>
  );
}

/** Mensaje informativo (por ejemplo, el 202 de solicitar-activacion). */
export function MensajeInformativo({ mensaje }: { mensaje: string | null }) {
  if (mensaje === null) {
    return null;
  }
  return (
    <p role="status" className={estilos['informativo']}>
      {mensaje}
    </p>
  );
}
