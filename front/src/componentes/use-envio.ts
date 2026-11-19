import { useCallback, useRef, useState } from 'react';
import { ErrorApi, mensajeDeError } from '../servicios-api/errores';
import { useEsperaReintento } from './espera-reintento';

/*
 * Envío de un formulario (F1b; reúne lo que repetían las pantallas de F0, F1
 * y F2):
 * - un solo envío a la vez: el cerrojo cierra la ventana entre dos clics
 *   antes de que React vuelva a pintar el botón deshabilitado;
 * - el error de cualquier fallo, con el texto uniforme de F0 (errores.ts);
 * - el 429 deja el botón en espera hasta que vence Retry-After (D15).
 * `ejecutar` nunca lanza: si la acción falla, devuelve undefined.
 */

export interface Envio {
  enviando: boolean;
  enEspera: boolean;
  error: string | null;
  ponerError: (texto: string | null) => void;
  ejecutar: <T>(accion: () => Promise<T>) => Promise<T | undefined>;
}

export function useEnvio(): Envio {
  const enCurso = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [error, ponerError] = useState<string | null>(null);
  const { enEspera, esperar } = useEsperaReintento();

  const ejecutar = useCallback(
    async <T>(accion: () => Promise<T>): Promise<T | undefined> => {
      if (enCurso.current) {
        return undefined;
      }
      enCurso.current = true;
      setEnviando(true);
      ponerError(null);
      try {
        return await accion();
      } catch (fallo) {
        ponerError(mensajeDeError(fallo));
        if (fallo instanceof ErrorApi && fallo.estado === 429) {
          esperar(fallo.esperaSegundos);
        }
        return undefined;
      } finally {
        enCurso.current = false;
        setEnviando(false);
      }
    },
    [esperar],
  );

  return { enviando, enEspera, error, ponerError, ejecutar };
}
