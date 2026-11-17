export interface PropiedadesPrograma {
  idPrograma: string;
  nombre: string;
}

/**
 * Entidad `Programa`. Cada estudiante cursa un programa y cada programa lo
 * dirige un solo Jefe de Departamento (línea base §4). El identificador se
 * llama `idPrograma` (confirmado por Ivan el 16/11/2026).
 */
export class Programa {
  readonly #idPrograma: string;
  readonly #nombre: string;

  constructor(propiedades: PropiedadesPrograma) {
    this.#idPrograma = propiedades.idPrograma;
    this.#nombre = propiedades.nombre;
  }

  get idPrograma(): string {
    return this.#idPrograma;
  }

  get nombre(): string {
    return this.#nombre;
  }
}
