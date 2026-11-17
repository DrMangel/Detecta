import { randomUUID } from 'node:crypto';
import { CasoRiesgo } from './caso-riesgo';
import type { Docente } from './docente';
import { EstadoCaso } from './estado-caso';
import type { Estudiante } from './estudiante';
import type { NivelRiesgo } from './nivel-riesgo';
import { OrigenRiesgo, type PropiedadesOrigenRiesgo } from './origen-riesgo';
import type { RegistroAcademico } from './registro-academico';

export interface PropiedadesAlerta extends PropiedadesOrigenRiesgo {
  nivelRiesgo: NivelRiesgo;
  descripcion: string;
  /** Docente que la emite (asociación "emite"). */
  docente: Docente;
  /** Registro académico que la sustenta (asociación "sustentada en", 1). */
  registro: RegistroAcademico;
}

/** Entidad `Alerta` (subclase de `OrigenRiesgo`), emitida por el docente (R01). */
export class Alerta extends OrigenRiesgo {
  readonly #nivelRiesgo: NivelRiesgo;
  readonly #descripcion: string;
  readonly #docente: Docente;
  readonly #registro: RegistroAcademico;

  constructor(propiedades: PropiedadesAlerta) {
    super(propiedades);
    this.#nivelRiesgo = propiedades.nivelRiesgo;
    this.#descripcion = propiedades.descripcion;
    this.#docente = propiedades.docente;
    this.#registro = propiedades.registro;
  }

  get nivelRiesgo(): NivelRiesgo {
    return this.#nivelRiesgo;
  }

  get descripcion(): string {
    return this.#descripcion;
  }

  /**
   * Único camino del dominio hacia el docente de un caso (D7, resuelta por
   * Ivan el 16/11/2026): el caso no tiene relación directa con `Docente`.
   */
  get docente(): Docente {
    return this.#docente;
  }

  get registro(): RegistroAcademico {
    return this.#registro;
  }

  obtenerEstudiante(): Estudiante {
    return this.#registro.estudiante;
  }

  /**
   * Genera el caso sin ruta y en estado PENDIENTE para que lo canalice el
   * Jefe de Departamento (sd_CUD03, línea base §4).
   * `confidencialidad = false` es una inferencia: sd_CUD02 solo marca como
   * confidencial el caso de la solicitud.
   */
  generarCasoRiesgo(): CasoRiesgo {
    if (!this.estaPendiente()) {
      throw new Error('Esta alerta ya generó su caso de riesgo');
    }
    const caso = new CasoRiesgo({
      idCaso: randomUUID(),
      fechaCreacion: new Date(),
      motivo: this.#descripcion,
      nivelRiesgo: this.#nivelRiesgo,
      ruta: null,
      estado: EstadoCaso.PENDIENTE,
      justificacion: '',
      confidencialidad: false,
      consentimientoConfirmado: false,
      estudiante: this.obtenerEstudiante(),
      origen: this,
      psicologo: null,
      citas: [],
    });
    this.marcarAtendido();
    return caso;
  }
}
