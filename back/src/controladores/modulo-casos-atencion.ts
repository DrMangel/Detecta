import { Module } from '@nestjs/common';
import { ControladorCasosRiesgo } from './controlador-casos-riesgo';
import { ModuloAcceso } from './modulo-acceso';
import { ModuloNotificacion } from './modulo-notificacion';

/**
 * Casos de riesgo, pertinencia y atención psicológica (fase B7: R03, R05 y
 * R06; módulo fuera del diagrama). ControlAcceso y el reloj llegan de
 * ModuloAcceso; ServicioNotificacion, de ModuloNotificacion; repositorios y
 * UnidadTrabajo, por token desde el módulo global de persistencia.
 */
@Module({
  imports: [ModuloAcceso, ModuloNotificacion],
  controllers: [ControladorCasosRiesgo],
})
export class ModuloCasosAtencion {}
