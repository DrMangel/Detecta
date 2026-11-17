import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONFIGURACION_NOTIFICACION,
  ServicioNotificacion,
  type ConfiguracionNotificacion,
} from '../aplicacion/servicios/servicio-notificacion';
import type { VariablesEntorno } from '../validacion-entorno';

/**
 * Notificaciones por correo (fase B5; módulo fuera del diagrama). El
 * ProveedorCorreo llega por token desde el módulo global de integración.
 * Lo importarán los módulos de B6 a B8, que generan los eventos.
 */
@Module({
  providers: [
    ServicioNotificacion,
    {
      provide: CONFIGURACION_NOTIFICACION,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<VariablesEntorno, true>,
      ): ConfiguracionNotificacion => ({
        urlFrontend: config.get('URL_FRONTEND', { infer: true }),
      }),
    },
  ],
  exports: [ServicioNotificacion],
})
export class ModuloNotificacion {}
