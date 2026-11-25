import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Cada prueba empieza como una pestaña nueva (decisión (g)).
  sessionStorage.clear();
});

/*
 * jsdom 31 no implementa showModal() ni close() de <dialog>. Sustituto
 * mínimo, solo para las pruebas (F5b-diseño, respuesta 10, opción A): abre
 * con el atributo open, cierra con el evento close y Esc emite cancel y
 * cierra, como el navegador. El foco atrapado y la capa de fondo no se
 * simulan: se comprueban en Chromium.
 */
function escapeCierra(this: HTMLDialogElement, evento: KeyboardEvent) {
  if (evento.key !== 'Escape') return;
  const cancelar = new Event('cancel', { cancelable: true });
  if (this.dispatchEvent(cancelar)) this.close();
}

if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
    this.addEventListener('keydown', escapeCierra);
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.removeEventListener('keydown', escapeCierra);
    this.dispatchEvent(new Event('close'));
  };
}
