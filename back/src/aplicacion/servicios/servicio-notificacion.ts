import { Inject, Injectable, Logger } from '@nestjs/common';
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
 */
@Injectable()
export class ServicioNotificacion {
  readonly #registro = new Logger('ServicioNotificacion');

  constructor(
    @Inject(PROVEEDOR_CORREO)
    private readonly correo: ProveedorCorreo,
    @Inject(CONFIGURACION_NOTIFICACION)
    private readonly configuracion: ConfiguracionNotificacion,
  ) {}

  /** (a) Alerta temprana emitida por el docente, notificada al estudiante. */
  async notificarAlertaEstudiante(alerta: Alerta): Promise<void> {
    const estudiante = alerta.obtenerEstudiante();
    await this.#enviar(
      'alerta',
      estudiante,
      plantillaAlerta(
        estudiante.nombre,
        alerta.registro.curso.nombre,
        this.configuracion.urlFrontend,
      ),
    );
  }

  /** (c) Caso remitido, al Psicólogo o al Jefe según la ruta (quien llama elige). */
  async notificarCasoRemitido(
    _caso: CasoRiesgo,
    destinatarios: readonly Persona[],
  ): Promise<void> {
    for (const destinatario of destinatarios) {
      await this.#enviar(
        'caso-remitido',
        destinatario,
        plantillaCasoRemitido(
          destinatario.nombre,
          this.configuracion.urlFrontend,
        ),
      );
    }
  }

  /** (b) Cita de asesoría programada o reprogramada (destinatario: quien llama). */
  async notificarCita(cita: Cita, destinatario: Persona): Promise<void> {
    await this.#enviar(
      'cita',
      destinatario,
      plantillaCita(destinatario.nombre, cita, this.configuracion.urlFrontend),
    );
  }

  /** (d) Plan de nivelación académica, notificado al estudiante. */
  async notificarPlanNivelacion(plan: PlanNivelacion): Promise<void> {
    const estudiante = plan.obtenerEstudiante();
    await this.#enviar(
      'plan-nivelacion',
      estudiante,
      plantillaPlanNivelacion(
        estudiante.nombre,
        this.configuracion.urlFrontend,
      ),
    );
  }

  async #enviar(
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
