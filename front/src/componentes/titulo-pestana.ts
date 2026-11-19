import { useEffect } from 'react';
import { NOMBRE_SISTEMA } from './textos';

/* Título de la pestaña por pantalla (ajuste B): «<pantalla> · DETECTA». */
export function useTituloPestana(titulo: string): void {
  useEffect(() => {
    document.title = `${titulo} · ${NOMBRE_SISTEMA}`;
  }, [titulo]);
}
