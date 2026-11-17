import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { RELOJ, type Reloj } from './servicio-autenticacion';
import { ServicioSincronizacion } from './servicio-sincronizacion';

/** Configuración de la sincronización (variables de entorno validadas). */
export interface ConfiguracionSincronizacion {
  /** HH:MM en hora de Bogotá; null desactiva la tarea nocturna. */
  horaNocturna: string | null;
  /** Secreto del disparo manual por HTTP; null desactiva la ruta. */
  secreto: string | null;
}

export const CONFIGURACION_SINCRONIZACION = Symbol(
  'ConfiguracionSincronizacion',
);

/** Bogotá: UTC-5 todo el año, sin horario de verano. */
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Milisegundos desde `ahora` hasta la próxima `hora` (HH:MM) de Bogotá. Si
 * esa hora ya pasó hoy (o es exactamente ahora), programa la de mañana.
 */
export function msHastaProximaEjecucion(ahora: Date, hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number);
  // Medianoche de hoy en Bogotá, expresada en UTC.
  const enBogota = ahora.getTime() - DESFASE_BOGOTA_MS;
  const medianocheBogota =
    Math.floor(enBogota / UN_DIA_MS) * UN_DIA_MS + DESFASE_BOGOTA_MS;
  let objetivo =
    medianocheBogota + ((horas ?? 0) * 60 + (minutos ?? 0)) * 60_000;
  if (objetivo <= ahora.getTime()) {
    objetivo += UN_DIA_MS;
  }
  return objetivo - ahora.getTime();
}

/**
 * Tarea nocturna de la sincronización (ER Tabla 2: "tarea programada en
 * horario nocturno"; respuesta 7 de Ivan: temporizador interno, sin
 * dependencias). Solo la inicia `main.ts` (el servidor), nunca los comandos
 * de línea ni las pruebas.
 *
 * Limitación documentada: no hay recuperación; si el proceso estaba apagado
 * a la hora programada, esa ejecución se pierde y se espera a la siguiente.
 */
@Injectable()
export class ProgramadorSincronizacion implements OnModuleDestroy {
  readonly #registro = new Logger('ProgramadorSincronizacion');
  #temporizador: NodeJS.Timeout | undefined;

  constructor(
    private readonly servicio: ServicioSincronizacion,
    @Inject(CONFIGURACION_SINCRONIZACION)
    private readonly configuracion: ConfiguracionSincronizacion,
    @Inject(RELOJ)
    private readonly reloj: Reloj,
  ) {}

  /** Programa la próxima ejecución; devuelve false si está desactivada. */
  iniciar(): boolean {
    const hora = this.configuracion.horaNocturna;
    if (hora === null) {
      this.#registro.log('Sincronización nocturna desactivada');
      return false;
    }
    const espera = msHastaProximaEjecucion(this.reloj(), hora);
    this.#temporizador = setTimeout(() => {
      void this.#ejecutar();
    }, espera);
    this.#registro.log(
      `Próxima sincronización nocturna a las ${hora} (Bogotá), en ${Math.round(espera / 60_000)} min`,
    );
    return true;
  }

  detener(): void {
    if (this.#temporizador !== undefined) {
      clearTimeout(this.#temporizador);
      this.#temporizador = undefined;
    }
  }

  onModuleDestroy(): void {
    this.detener();
  }

  async #ejecutar(): Promise<void> {
    try {
      await this.servicio.sincronizarTodo();
      const resultado = this.servicio.obtenerUltimoResultado();
      this.#registro.log(
        `Sincronización nocturna: ${resultado?.actualizados ?? 0} registros actualizados, ${resultado?.omitidos ?? 0} omitidos`,
      );
    } catch (error) {
      // Mensajes del conector o de infraestructura: nunca incluyen secretos.
      this.#registro.error(
        `Sincronización nocturna fallida: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.iniciar();
    }
  }
}
