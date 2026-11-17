import type { Rol } from './rol';

export interface PropiedadesPersona {
  id: string;
  nombre: string;
  correo: string;
  contrasenaHash: string;
}

/**
 * Entidad abstracta `Persona` (diagrama de entidades). Base de los cuatro
 * actores del sistema (línea base §4). En el modelo persistente se mapea con
 * herencia de tabla única (B2).
 */
export abstract class Persona {
  readonly #id: string;
  readonly #nombre: string;
  readonly #correo: string;
  // Atributo privado (línea base §4) sin getter (plan de B1): la lectura del
  // mapeador se define en B2 y la verificación con bcrypt en B3. Es `#` y no
  // `protected` para que no sea una propiedad enumerable: así nunca se filtra
  // al serializar la entidad (p. ej. JSON.stringify). Como ninguna operación
  // lo lee todavía, se suprime el aviso de "no leído" solo aquí; cuando B2 o
  // B3 lo lean, @ts-expect-error fallará y obligará a quitar esta supresión.
  /* oxlint-disable no-unused-private-class-members */
  // @ts-expect-error TS6133: se leerá en B2/B3 (ver comentario anterior).
  readonly #contrasenaHash: string;
  /* oxlint-enable no-unused-private-class-members */

  protected constructor(propiedades: PropiedadesPersona) {
    this.#id = propiedades.id;
    this.#nombre = propiedades.nombre;
    this.#correo = propiedades.correo;
    this.#contrasenaHash = propiedades.contrasenaHash;
  }

  get id(): string {
    return this.#id;
  }

  get nombre(): string {
    return this.#nombre;
  }

  get correo(): string {
    return this.#correo;
  }

  abstract obtenerRol(): Rol;
}
