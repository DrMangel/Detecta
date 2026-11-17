import type { Rol } from './rol';

export interface PropiedadesPersona {
  id: string;
  nombre: string;
  correo: string;
  contrasenaHash: string;
}

/**
 * Lectura de acceso restringido de `contrasenaHash` (aprobada por Ivan en el
 * plan de B2). No es un método ni un getter: es una función de módulo que se
 * asigna en el bloque estático de `Persona`, la única forma de leer un campo
 * `#` privado desde fuera de la clase. Así el hash no es propiedad del objeto
 * ni del prototipo y nunca aparece al serializar (JSON.stringify).
 *
 * Solo la pueden importar archivos de `persistencia/` (mapeador, B2) y
 * `ServicioAutenticacion` (verificación con bcrypt, B3). Lo verifica la
 * prueba `src/acceso-contrasena.spec.ts`.
 */
export let leerContrasenaHash: (persona: Persona) => string;

/**
 * Entidad abstracta `Persona` (diagrama de entidades). Base de los cuatro
 * actores del sistema (línea base §4). En el modelo persistente se mapea con
 * herencia de tabla única (B2).
 */
export abstract class Persona {
  static {
    leerContrasenaHash = (persona) => persona.#contrasenaHash;
  }

  readonly #id: string;
  readonly #nombre: string;
  readonly #correo: string;
  // Atributo privado (línea base §4), sin getter: se lee solo con
  // `leerContrasenaHash`.
  readonly #contrasenaHash: string;

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
