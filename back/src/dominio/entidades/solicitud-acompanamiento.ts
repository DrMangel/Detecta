import { randomUUID } from 'node:crypto';
import { CasoRiesgo } from './caso-riesgo';
import { EstadoCaso } from './estado-caso';
import type { Estudiante } from './estudiante';
import { OrigenRiesgo, type PropiedadesOrigenRiesgo } from './origen-riesgo';
import { RutaAtencion } from './ruta-atencion';

export interface PropiedadesSolicitudAcompanamiento extends PropiedadesOrigenRiesgo {
  tipoApoyo: RutaAtencion;
  motivo: string;
  disponibilidad: string;
  /** Estudiante que la radica (asociación "radica"). */
  estudiante: Estudiante;
}

/**
 * Entidad `SolicitudAcompanamiento` (subclase de `OrigenRiesgo`), radicada
 * voluntariamente por el estudiante (R02). El reporte es confidencial: el
 * caso que genera no tiene docente (D7).
 */
export class SolicitudAcompanamiento extends OrigenRiesgo {
  readonly #tipoApoyo: RutaAtencion;
  readonly #motivo: string;
  readonly #disponibilidad: string;
  readonly #estudiante: Estudiante;

  constructor(propiedades: PropiedadesSolicitudAcompanamiento) {
    super(propiedades);
    this.#tipoApoyo = propiedades.tipoApoyo;
    this.#motivo = propiedades.motivo;
    this.#disponibilidad = propiedades.disponibilidad;
    this.#estudiante = propiedades.estudiante;
  }

  get tipoApoyo(): RutaAtencion {
    return this.#tipoApoyo;
  }

  get motivo(): string {
    return this.#motivo;
  }

  get disponibilidad(): string {
    return this.#disponibilidad;
  }

  obtenerEstudiante(): Estudiante {
    return this.#estudiante;
  }

  /**
   * Genera el caso confidencial (sd_CUD02). Solo la solicitud psicosocial
   * fija la ruta PSICOLOGICA; la académica nace sin ruta para que el Jefe la
   * canalice en CUD04 (nota de sd_CUD02, línea base §4).
   */
  generarCasoRiesgo(): CasoRiesgo {
    if (!this.estaPendiente()) {
      throw new Error('Esta solicitud ya generó su caso de riesgo');
    }
    const caso = new CasoRiesgo({
      idCaso: randomUUID(),
      fechaCreacion: new Date(),
      motivo: this.#motivo,
      nivelRiesgo: null,
      ruta:
        this.#tipoApoyo === RutaAtencion.PSICOLOGICA
          ? RutaAtencion.PSICOLOGICA
          : null,
      estado: EstadoCaso.PENDIENTE,
      justificacion: '',
      confidencialidad: true,
      consentimientoConfirmado: false,
      estudiante: this.#estudiante,
      origen: this,
      psicologo: null,
      citas: [],
    });
    this.marcarAtendido();
    return caso;
  }
}
