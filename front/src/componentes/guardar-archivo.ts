/*
 * Entrega al navegador un archivo ya descargado (F3, exportar el informe en
 * PDF; ajuste C): un enlace temporal con `download` que no se agrega al DOM,
 * y la URL del Blob se libera tras el clic. Nada se guarda en el
 * almacenamiento del navegador.
 */
export function guardarArchivo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
