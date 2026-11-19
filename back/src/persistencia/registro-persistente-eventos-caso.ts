import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import {
  TipoEventoCaso,
  type EventoCaso,
  type RegistroEventosCaso,
} from '../aplicacion/contratos/registro-eventos-caso';

/**
 * Adaptador de `RegistroEventosCaso` (B9, trazabilidad). Un INSERT por
 * evento en el EntityManager de la transacción (consultas en serie, R9).
 * `ocurrido_en` no se envía: lo fija el DEFAULT now() de PostgreSQL.
 */
export class RegistroPersistenteEventosCaso implements RegistroEventosCaso {
  constructor(private readonly manager: EntityManager) {}

  async registrar(evento: EventoCaso): Promise<void> {
    const reprogramacion =
      evento.tipo === TipoEventoCaso.CITA_REPROGRAMADA ? evento : null;
    await this.manager.query(
      `INSERT INTO evento_caso (id_evento, id_caso, id_actor, tipo, id_plan,
         id_cita, fecha_hora_anterior, fecha_hora_nueva, modalidad_anterior,
         modalidad_nueva)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        randomUUID(),
        evento.idCaso,
        evento.idActor,
        evento.tipo,
        evento.tipo === TipoEventoCaso.PLAN_FINALIZADO ? evento.idPlan : null,
        evento.tipo === TipoEventoCaso.CITA_PROGRAMADA ||
        evento.tipo === TipoEventoCaso.CITA_REPROGRAMADA
          ? evento.idCita
          : null,
        reprogramacion?.fechaHoraAnterior ?? null,
        reprogramacion?.fechaHoraNueva ?? null,
        reprogramacion?.modalidadAnterior ?? null,
        reprogramacion?.modalidadNueva ?? null,
      ],
    );
  }
}
