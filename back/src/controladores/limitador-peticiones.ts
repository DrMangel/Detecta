import {
  TOPE_CLAVES,
  VENTANA_ACTIVACION_MS,
  VENTANA_INICIO_SESION_MS,
} from './limites-peticiones';

/**
 * Limitador de peticiones en memoria con ventana deslizante (fase B9, D15;
 * ajuste A). Una instancia por política, cada una con su ventana. Por cada
 * clave guarda como máximo `limite` marcas de tiempo.
 *
 * - Memoria acotada: como mucho `topeClaves` claves; al llegar al tope se
 *   limpian las vencidas y, si no basta, se descarta la clave más antigua.
 * - Reloj inyectado para las pruebas.
 * - En memoria y por instancia (limitación aceptada).
 */
export class LimitadorPeticiones {
  readonly #marcas = new Map<string, number[]>();

  constructor(
    private readonly reloj: () => Date,
    private readonly ventanaMs: number,
    private readonly topeClaves: number = TOPE_CLAVES,
  ) {}

  /**
   * Segundos que faltan para volver a intentar si la clave ya alcanzó el
   * límite en la ventana; null si todavía puede.
   */
  bloqueo(clave: string, limite: number): number | null {
    const vigentes = this.#vigentes(clave);
    if (vigentes.length < limite) {
      return null;
    }
    const masAntigua = vigentes[vigentes.length - limite] ?? this.#ahora();
    const esperaMs = masAntigua + this.ventanaMs - this.#ahora();
    return Math.max(1, Math.ceil(esperaMs / 1000));
  }

  /** Registra un evento (una petición o un fallo) para la clave. */
  registrar(clave: string, limite: number): void {
    const vigentes = this.#vigentes(clave);
    vigentes.push(this.#ahora());
    this.#marcas.delete(clave);
    if (this.#marcas.size >= this.topeClaves) {
      this.#liberarEspacio();
    }
    // Solo hacen falta las últimas `limite` marcas.
    this.#marcas.set(clave, vigentes.slice(-limite));
  }

  /** Reinicia la clave (p. ej. tras un inicio de sesión exitoso). */
  reiniciar(clave: string): void {
    this.#marcas.delete(clave);
  }

  /** Claves en memoria (para las pruebas de memoria acotada). */
  get tamano(): number {
    return this.#marcas.size;
  }

  #vigentes(clave: string): number[] {
    const limiteInferior = this.#ahora() - this.ventanaMs;
    const vigentes = (this.#marcas.get(clave) ?? []).filter(
      (marca) => marca > limiteInferior,
    );
    if (vigentes.length === 0) {
      this.#marcas.delete(clave);
    }
    return vigentes;
  }

  #liberarEspacio(): void {
    const limiteInferior = this.#ahora() - this.ventanaMs;
    for (const [clave, marcas] of this.#marcas) {
      if ((marcas.at(-1) ?? 0) <= limiteInferior) {
        this.#marcas.delete(clave);
      }
    }
    // Si sigue lleno, se descarta la clave insertada hace más tiempo.
    while (this.#marcas.size >= this.topeClaves) {
      const primera = this.#marcas.keys().next().value;
      if (primera === undefined) {
        break;
      }
      this.#marcas.delete(primera);
    }
  }

  #ahora(): number {
    return this.reloj().getTime();
  }
}

/** Los dos limitadores del ajuste A, inyectables (las pruebas los sustituyen). */
export interface Limitadores {
  inicioSesion: LimitadorPeticiones;
  activacion: LimitadorPeticiones;
}

export const LIMITADORES = Symbol('Limitadores');

export function crearLimitadores(reloj: () => Date): Limitadores {
  return {
    inicioSesion: new LimitadorPeticiones(reloj, VENTANA_INICIO_SESION_MS),
    activacion: new LimitadorPeticiones(reloj, VENTANA_ACTIVACION_MS),
  };
}
