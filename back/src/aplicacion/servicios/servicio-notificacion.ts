import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Alerta } from '../../dominio/entidades/alerta';
import type { CasoRiesgo } from '../../dominio/entidades/caso-riesgo';
import type { Cita } from '../../dominio/entidades/cita';
import type { Persona } from '../../dominio/entidades/persona';
import type { PlanNivelacion } from '../../dominio/entidades/plan-nivelacion';
import {
  ErrorEnvioCorreo,
  PROVEEDOR_CORREO,
  type ProveedorCorreo,
} from '../contratos/proveedor-correo';
import {
  plantillaAlerta,
  plantillaCasoRemitido,
  plantillaCita,
  plantillaPlanNivelacion,
  type MensajeCorreo,
} from './plantillas-correo';

export interface ConfiguracionNotificacion {
  /** Origen del frontend: enlace al sistema en cada correo. */
  urlFrontend: string;
}

export const CONFIGURACION_NOTIFICACION = Symbol('ConfiguracionNotificacion');

/** Mensajes de finalización de la Tabla 1 del ER. */
export const MENSAJES_TABLA_1 = {
  enviado: 'Correo enviado',
  error: 'Error de envío',
} as const;

type TipoNotificacion = 'alerta' | 'caso-remitido' | 'cita' | 'plan-nivelacion';

/**
 * Servicio `ServicioNotificacion` (diagrama de clases v3; ER Tabla 1: cuatro
 * tipos de evento). Firmas del diagrama, con una diferencia aprobada en B5:
 * `notificarCita(cita, destinatario)`, porque la Cita no conoce su caso ni su
 * estudiante (asociación "programa" navegable solo desde CasoRiesgo).
 *
 * Ante un fallo registra "Error de envío" y NO lanza (respuesta 3 de Ivan):
 * la entrega no está garantizada (ER Tabla 1) y no debe interrumpir el flujo
 * de negocio. El registro nunca incluye destinatario, cuerpo ni asunto
 * completo (respuesta 7): solo el resultado, el tipo y el código técnico.
 *
 * B6 (respuesta 6 de Ivan; fuera del diagrama): quien llama lanza el envío
 * después de confirmar la transacción y NO lo espera, para que el correo no
 * retrase la operación de negocio (CUD02: menos de 3 s). El servicio lleva
 * el registro de los envíos en curso y `onApplicationShutdown()` los espera
 * (también es la espera determinista de las pruebas).
 */
@Injectable()
export class ServicioNotificacion implements OnApplicationShutdown {
  readonly #registro = new Logger('ServicioNotificacion');
  readonly #enviosEnCurso = new Set<Promise<void>>();

  constructor(
    @Inject(PROVEEDOR_CORREO)
    private readonly correo: ProveedorCorreo,
    @Inject(CONFIGURACION_NOTIFICACION)
    private readonly configuracion: ConfiguracionNotificacion,
  ) {}

  /** (a) Alerta temprana emitida por el docente, notificada al estudiante. */
  notificarAlertaEstudiante(alerta: Alerta): Promise<void> {
    return this.#rastrear('alerta', async () => {
      const estudiante = alerta.obtenerEstudiante();
      await this.#intentarEnvio(
        'alerta',
        estudiante,
        plantillaAlerta(
          estudiante.nombre,
          alerta.registro.curso.nombre,
          this.configuracion.urlFrontend,
        ),
      );
    });
  }

  /** (c) Caso remitido, al Psicólogo o al Jefe según la ruta (quien llama elige). */
  notificarCasoRemitido(
    _caso: CasoRiesgo,
    destinatarios: readonly Persona[],
  ): Promise<void> {
    return this.#rastrear('caso-remitido', async () => {
      for (const destinatario of destinatarios) {
        await this.#intentarEnvio(
          'caso-remitido',
          destinatario,
          plantillaCasoRemitido(
            destinatario.nombre,
            this.configuracion.urlFrontend,
          ),
        );
      }
    });
  }

  /**
   * (b) Cita de asesoría programada o reprogramada. Destinatario: el
   * estudiante (D26). `requiereConsentimiento` agrega el requisito previo
   * genérico (B7; parámetro fuera del diagrama).
   */
  notificarCita(
    cita: Cita,
    destinatario: Persona,
    requiereConsentimiento = false,
  ): Promise<void> {
    return this.#rastrear('cita', () =>
      this.#intentarEnvio(
        'cita',
        destinatario,
        plantillaCita(
          destinatario.nombre,
          cita,
          this.configuracion.urlFrontend,
          requiereConsentimiento,
        ),
      ),
    );
  }

  /** (d) Plan de nivelación académica, notificado al estudiante. */
  notificarPlanNivelacion(plan: PlanNivelacion): Promise<void> {
    return this.#rastrear('plan-nivelacion', async () => {
      const estudiante = plan.obtenerEstudiante();
      await this.#intentarEnvio(
        'plan-nivelacion',
        estudiante,
        plantillaPlanNivelacion(
          estudiante.nombre,
          this.configuracion.urlFrontend,
        ),
      );
    });
  }

  /** Espera las notificaciones que sigan en curso (cierre de la aplicación). */
  async onApplicationShutdown(): Promise<void> {
    while (this.#enviosEnCurso.size > 0) {
      await Promise.all(this.#enviosEnCurso);
    }
  }

  /**
   * Registra la notificación completa (con todos sus destinatarios) como en
   * curso y garantiza que su promesa nunca se rechace: quien la lanza sin
   * esperarla no deja un rechazo sin manejar.
   */
  #rastrear(
    tipo: TipoNotificacion,
    trabajo: () => Promise<void>,
  ): Promise<void> {
    const envio = trabajo()
      .catch(() => {
        this.#registro.error(
          `${MENSAJES_TABLA_1.error} (${tipo}): DESCONOCIDO`,
        );
      })
      .finally(() => this.#enviosEnCurso.delete(envio));
    this.#enviosEnCurso.add(envio);
    return envio;
  }

  async #intentarEnvio(
    tipo: TipoNotificacion,
    destinatario: Persona,
    mensaje: MensajeCorreo,
  ): Promise<void> {
    try {
      const aceptado = await this.correo.enviar(
        destinatario.correo,
        mensaje.asunto,
        mensaje.cuerpoHtml,
      );
      if (aceptado) {
        this.#registro.log(`${MENSAJES_TABLA_1.enviado} (${tipo})`);
      } else {
        this.#registro.warn(`${MENSAJES_TABLA_1.error} (${tipo}): NO_ENVIADO`);
      }
    } catch (error) {
      const codigo =
        error instanceof ErrorEnvioCorreo ? error.codigo : 'DESCONOCIDO';
      this.#registro.error(`${MENSAJES_TABLA_1.error} (${tipo}): ${codigo}`);
    }
  }
}
