import { useCallback, useEffect, useState } from 'react';

/*
 * Espera de un 429 (D15; plan del front, F0): el botón queda deshabilitado
 * hasta que vence Retry-After. Sin texto de cuenta regresiva (no aprobado).
 */
export function useEsperaReintento(): {
  enEspera: boolean;
  esperar: (segundos: number | null) => void;
} {
  const [hasta, setHasta] = useState<number | null>(null);

  useEffect(() => {
    if (hasta === null) {
      return undefined;
    }
    const temporizador = setTimeout(
      () => setHasta(null),
      Math.max(0, hasta - Date.now()),
    );
    return () => clearTimeout(temporizador);
  }, [hasta]);

  const esperar = useCallback((segundos: number | null) => {
    if (segundos !== null && segundos > 0) {
      setHasta(Date.now() + segundos * 1000);
    }
  }, []);

  return { enEspera: hasta !== null, esperar };
}
