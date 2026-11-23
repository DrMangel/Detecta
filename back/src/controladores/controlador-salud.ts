import { Controller, Get } from '@nestjs/common';
import { Publico } from './sesion';

/**
 * GET /salud: cambio operativo de F6, aprobado por Ivan y fuera de los
 * diagramas (línea base §5, §7 y §14). El monitor externo (J3) necesita una
 * respuesta 2xx para mantener despierto el servicio gratuito de Render.
 *
 * Sin dependencias a propósito: no consulta la base (Neon puede seguir
 * suspendiéndose), no usa el limitador y no expone versión, hora ni estado
 * interno.
 */
@Controller('salud')
@Publico()
export class ControladorSalud {
  @Get()
  consultar(): { estado: 'ok' } {
    return { estado: 'ok' };
  }
}
