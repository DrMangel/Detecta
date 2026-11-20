import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardarArchivo } from './guardar-archivo';

/*
 * Entrega al navegador un archivo descargado (F3, exportar el informe en
 * PDF; ajuste C): enlace temporal con `download`, URL del Blob liberada tras
 * el clic y nada en el almacenamiento del navegador.
 */
describe('guardarArchivo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('descarga con el nombre indicado, libera la URL y no deja el enlace en el DOM', () => {
    const crear = vi.fn(() => 'blob:prueba');
    const liberar = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: crear,
      revokeObjectURL: liberar,
    });
    const clics: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clics.push({ href: this.href, download: this.download });
    });
    const contenido = new Blob(['%PDF']);

    guardarArchivo(contenido, 'informe-riesgo-2026-2-MAT101.pdf');

    expect(crear).toHaveBeenCalledWith(contenido);
    expect(clics).toEqual([
      { href: 'blob:prueba', download: 'informe-riesgo-2026-2-MAT101.pdf' },
    ]);
    expect(liberar).toHaveBeenCalledWith('blob:prueba');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
