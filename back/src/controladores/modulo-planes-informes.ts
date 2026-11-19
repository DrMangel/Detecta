import { Module } from '@nestjs/common';
import { GeneradorInformeRiesgo } from '../aplicacion/servicios/generador-informe-riesgo';
import { ControladorInformes } from './controlador-informes';
import { ControladorPlanNivelacion } from './controlador-plan-nivelacion';
import { ModuloAcceso } from './modulo-acceso';
import { ModuloNotificacion } from './modulo-notificacion';

/**
 * Plan de nivelación e informes de riesgo (fase B8: R04 y R07; módulo fuera
 * del diagrama). ControlAcceso llega de ModuloAcceso; ServicioNotificacion,
 * de ModuloNotificacion; repositorios y UnidadTrabajo, por token desde el
 * módulo global de persistencia.
 */
@Module({
  imports: [ModuloAcceso, ModuloNotificacion],
  controllers: [ControladorPlanNivelacion, ControladorInformes],
  providers: [GeneradorInformeRiesgo],
})
export class ModuloPlanesInformes {}
