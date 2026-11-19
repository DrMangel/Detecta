/**
 * Tipo `Archivo` del diagrama de clases v3 (`exportar(informe): Archivo`,
 * `exportarInforme(idInforme): Archivo`). El diagrama no define sus
 * atributos: se fijan en B8 (diferencia reportada).
 */
export interface Archivo {
  /** Nombre fijo, sin datos personales (ajuste A del plan de B8). */
  nombre: string;
  tipoContenido: string;
  contenido: Buffer;
}
