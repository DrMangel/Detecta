import { randomUUID } from 'node:crypto';
import { Cita } from './cita';
import { EstadoCaso } from './estado-caso';
import { EstadoCita } from './estado-cita';
import type { Estudiante } from './estudiante';
import type { Modalidad } from './modalidad';
import type { NivelRiesgo } from './nivel-riesgo';
import type { OrigenRiesgo } from './origen-riesgo';
import type { Psicologo } from './psicologo';
import { RutaAtencion } from './ruta-atencion';

export interface PropiedadesCasoRiesgo {
  idCaso: string;
  fechaCreacion: Date;
  motivo: string;
  nivelRiesgo: NivelRiesgo | null;
  ruta: RutaAtencion | null;
  estado: EstadoCaso;
  justificacion: string;
  confidencialidad: boolean;
  consentimientoConfirmado: boolean;
  /** Estudiante al que pertenece el caso (asociación "pertenece a", 1). */
  estudiante: Estudiante;
  /** Único origen del caso: una Alerta o una SolicitudAcompanamiento (D7). */
  origen: OrigenRiesgo;
  /** Psicólogo que lo evalúa (asociación "evaluado por", 0..1). */
  psicologo: Psicologo | null;
  /** Citas programadas para el caso (asociación "programa"). */
  citas: readonly Cita[];
}

/** Estados que cuentan como finalizados para `estaFinalizado()` (R07, sd_CUD10). */
const ESTADOS_FINALIZADOS: readonly EstadoCaso[] = [
  EstadoCaso.CERRADO,
  EstadoCaso.ARCHIVADO,
];

/**
 * Estados terminales: el caso ya no admite cambios. Es un conjunto distinto
 * de ESTADOS_FINALIZADOS porque REORIENTADO es terminal pero no cuenta como
 * finalizado mientras D11 siga abierta (auditoría de B1).
 */
const ESTADOS_TERMINALES: readonly EstadoCaso[] = [
  EstadoCaso.CERRADO,
  EstadoCaso.ARCHIVADO,
  EstadoCaso.REORIENTADO,
];

/**
 * Entidad `CasoRiesgo`, agregado raíz junto con `Cita` (diagrama de clases v3).
 *
 * Integridad (D7, resuelta por Ivan el 16/11/2026, prevalece sobre ER 3.5.5):
 * el caso tiene siempre motivo, estudiante y exactamente un origen (Alerta o
 * SolicitudAcompanamiento). No tiene relación directa con `Docente`: el
 * docente solo se conoce a través de la Alerta que lo originó.
 *
 * Estados aprobados en el plan de B1:
 * PENDIENTE → canalizar(ACADEMICA) → EN_NIVELACION;
 * PENDIENTE (ruta PSICOLOGICA) → asignarPsicologo → EN_EVALUACION;
 * primera programarCita → CITADO; siguientes → EN_SEGUIMIENTO;
 * archivar → ARCHIVADO; reorientar → REORIENTADO; cerrar → CERRADO.
 */
export class CasoRiesgo {
  readonly #idCaso: string;
  readonly #fechaCreacion: Date;
  readonly #motivo: string;
  readonly #nivelRiesgo: NivelRiesgo | null;
  #ruta: RutaAtencion | null;
  #estado: EstadoCaso;
  #justificacion: string;
  readonly #confidencialidad: boolean;
  #consentimientoConfirmado: boolean;
  readonly #estudiante: Estudiante;
  readonly #origen: OrigenRiesgo;
  #psicologo: Psicologo | null;
  readonly #citas: Cita[];

  constructor(propiedades: PropiedadesCasoRiesgo) {
    // Verificación en tiempo de ejecución además del tipo: los datos pueden
    // llegar de la persistencia (B2) sin pasar por el compilador.
    if (
      typeof propiedades.motivo !== 'string' ||
      propiedades.motivo.trim() === ''
    ) {
      throw new Error('El caso de riesgo requiere un motivo (D7)');
    }
    if (!propiedades.estudiante) {
      throw new Error('El caso de riesgo requiere un estudiante (D7)');
    }
    if (!propiedades.origen) {
      throw new Error(
        'El caso de riesgo requiere exactamente un origen: una alerta o una solicitud (D7)',
      );
    }
    this.#idCaso = propiedades.idCaso;
    this.#fechaCreacion = new Date(propiedades.fechaCreacion);
    this.#motivo = propiedades.motivo;
    this.#nivelRiesgo = propiedades.nivelRiesgo;
    this.#ruta = propiedades.ruta;
    this.#estado = propiedades.estado;
    this.#justificacion = propiedades.justificacion;
    this.#confidencialidad = propiedades.confidencialidad;
    this.#consentimientoConfirmado = propiedades.consentimientoConfirmado;
    this.#estudiante = propiedades.estudiante;
    this.#origen = propiedades.origen;
    this.#psicologo = propiedades.psicologo;
    this.#citas = [...propiedades.citas];
  }

  get idCaso(): string {
    return this.#idCaso;
  }

  get fechaCreacion(): Date {
    return new Date(this.#fechaCreacion);
  }

  get motivo(): string {
    return this.#motivo;
  }

  get nivelRiesgo(): NivelRiesgo | null {
    return this.#nivelRiesgo;
  }

  get ruta(): RutaAtencion | null {
    return this.#ruta;
  }

  get estado(): EstadoCaso {
    return this.#estado;
  }

  get justificacion(): string {
    return this.#justificacion;
  }

  get confidencialidad(): boolean {
    return this.#confidencialidad;
  }

  get consentimientoConfirmado(): boolean {
    return this.#consentimientoConfirmado;
  }

  get origen(): OrigenRiesgo {
    return this.#origen;
  }

  get psicologo(): Psicologo | null {
    return this.#psicologo;
  }

  get citas(): readonly Cita[] {
    return [...this.#citas];
  }

  obtenerEstudiante(): Estudiante {
    return this.#estudiante;
  }

  /** Fija la ruta de atención (R03, sd_CUD04). Un caso se canaliza una sola vez (5.a). */
  canalizar(ruta: RutaAtencion): void {
    this.#exigirNoTerminal();
    if (this.estaCanalizado()) {
      throw new Error('El caso ya fue canalizado');
    }
    this.#ruta = ruta;
    if (ruta === RutaAtencion.ACADEMICA) {
      this.#estado = EstadoCaso.EN_NIVELACION;
    }
  }

  estaCanalizado(): boolean {
    return this.#ruta !== null;
  }

  /**
   * Asigna el psicólogo que evalúa el caso (R05, sd_CUD06). Devuelve `false`
   * si el caso ya tiene otro psicólogo: cada caso lo atiende uno solo
   * (línea base §4, trazabilidad ER 1.3.4). Exige ruta PSICOLOGICA.
   */
  asignarPsicologo(psicologo: Psicologo): boolean {
    this.#exigirNoTerminal();
    this.#exigirRutaPsicologica();
    if (this.#psicologo !== null && this.#psicologo.id !== psicologo.id) {
      return false;
    }
    this.#psicologo = psicologo;
    if (this.#estado === EstadoCaso.PENDIENTE) {
      this.#estado = EstadoCaso.EN_EVALUACION;
    }
    return true;
  }

  /**
   * Dictamina el caso como pertinente (R05, sd_CUD06). `EstadoCaso` no tiene
   * un valor propio para "aprobado": el caso sigue EN_EVALUACION hasta que se
   * programe la cita.
   */
  aprobar(): void {
    this.#exigirNoTerminal();
    this.#exigirRutaPsicologica();
    if (this.#psicologo === null || this.#estado !== EstadoCaso.EN_EVALUACION) {
      throw new Error(
        'El caso debe estar en evaluación por un psicólogo para aprobarse',
      );
    }
  }

  /**
   * No pertinente (CUD07, 2.a). La justificación es obligatoria (Manual
   * CU_10, paso 4 y requisito de trazabilidad de la justificación técnica).
   */
  archivar(justificacion: string): void {
    this.#exigirNoTerminal();
    this.#exigirJustificacion(justificacion);
    this.#justificacion = justificacion;
    this.#estado = EstadoCaso.ARCHIVADO;
  }

  /** Corresponde a otra área (CUD07, 2.b; Manual CU_10, 4a). Justificación obligatoria. */
  reorientar(justificacion: string): void {
    this.#exigirNoTerminal();
    this.#exigirJustificacion(justificacion);
    this.#justificacion = justificacion;
    this.#estado = EstadoCaso.REORIENTADO;
  }

  /**
   * Indica si la atención requiere el consentimiento del acudiente: el
   * estudiante es menor de edad y aún no se ha confirmado (R05/R06). La firma
   * ocurre fuera del sistema (línea base §4).
   */
  requiereConsentimiento(fechaActual: Date): boolean {
    return (
      this.#estudiante.esMenorDeEdad(fechaActual) &&
      !this.#consentimientoConfirmado
    );
  }

  /** El psicólogo confirma que el acudiente otorgó el consentimiento (R06, CUD09). */
  confirmarConsentimiento(): void {
    this.#consentimientoConfirmado = true;
  }

  /** Mayor de edad o consentimiento confirmado (nota del diagrama, R05/R06). */
  habilitadoParaAtencion(fechaActual: Date): boolean {
    return (
      !this.#estudiante.esMenorDeEdad(fechaActual) ||
      this.#consentimientoConfirmado
    );
  }

  /**
   * Programa una cita PROGRAMADA (sd_CUD06). La primera deja el caso CITADO
   * y las de seguimiento, EN_SEGUIMIENTO. No exige consentimiento (ER R05):
   * el bloqueo del menor aplica al registrar el resultado (R06, servicio B7).
   * Antes de crearla verifica el cruce de horario con
   * `psicologo.estaDisponible` (ER R05; sd_CUD06, 4.a de CUD07) y, si no hay
   * cruce, la registra en la agenda del psicólogo.
   */
  programarCita(fechaHora: Date, modalidad: Modalidad): Cita {
    this.#exigirNoTerminal();
    this.#exigirRutaPsicologica();
    const psicologo = this.#psicologo;
    if (psicologo === null) {
      throw new Error('El caso no tiene un psicólogo asignado');
    }
    if (!psicologo.estaDisponible(fechaHora)) {
      throw new Error('El psicólogo ya tiene una cita en esa fecha y hora');
    }
    const cita = new Cita({
      idCita: randomUUID(),
      fechaHora,
      modalidad,
      estado: EstadoCita.PROGRAMADA,
      asesoria: null,
    });
    this.#estado =
      this.#citas.length === 0 ? EstadoCaso.CITADO : EstadoCaso.EN_SEGUIMIENTO;
    this.#citas.push(cita);
    psicologo.agendar(cita);
    return cita;
  }

  /**
   * Cierra el caso si la asesoría de su última cita está completa (R06,
   * sd_CUD06 6.b). Devuelve `false` si no hay citas o la asesoría falta o
   * está incompleta (línea base §4).
   */
  cerrar(): boolean {
    this.#exigirNoTerminal();
    const ultimaCita = this.#citas.reduce<Cita | null>(
      (ultima, cita) =>
        ultima === null ||
        cita.fechaHora.getTime() >= ultima.fechaHora.getTime()
          ? cita
          : ultima,
      null,
    );
    if (ultimaCita?.asesoria?.estaCompleta() !== true) {
      return false;
    }
    this.#estado = EstadoCaso.CERRADO;
    return true;
  }

  /**
   * Verdadero solo para CERRADO y ARCHIVADO (ER R07, sd_CUD10: "cerrados o
   * archivados"). REORIENTADO queda fuera (decisión abierta D11).
   */
  estaFinalizado(): boolean {
    return ESTADOS_FINALIZADOS.includes(this.#estado);
  }

  // Auxiliares privados fuera del diagrama: solo verifican precondiciones.

  #exigirNoTerminal(): void {
    if (ESTADOS_TERMINALES.includes(this.#estado)) {
      throw new Error(
        `El caso está ${this.#estado} y no admite cambios (estado terminal)`,
      );
    }
  }

  #exigirJustificacion(justificacion: string): void {
    if (justificacion.trim() === '') {
      throw new Error('Registre la justificación');
    }
  }

  #exigirRutaPsicologica(): void {
    if (this.#ruta !== RutaAtencion.PSICOLOGICA) {
      throw new Error('La operación requiere un caso con ruta PSICOLOGICA');
    }
  }
}
