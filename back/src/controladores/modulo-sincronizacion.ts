import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONFIGURACION_SINCRONIZACION,
  ProgramadorSincronizacion,
  type ConfiguracionSincronizacion,
} from '../aplicacion/servicios/programador-sincronizacion';
import {
  RELOJ,
  type Reloj,
} from '../aplicacion/servicios/servicio-autenticacion';
import { ServicioSincronizacion } from '../aplicacion/servicios/servicio-sincronizacion';
import type { VariablesEntorno } from '../validacion-entorno';
import { ControladorSincronizacion } from './controlador-sincronizacion';

/**
 * Sincronización con la BD institucional (fase B4; módulo fuera del
 * diagrama). El conector, la unidad de trabajo y los repositorios llegan por
 * token desde los módulos globales de integración y persistencia.
 */
@Module({
  controllers: [ControladorSincronizacion],
  providers: [
    ServicioSincronizacion,
    ProgramadorSincronizacion,
    {
      provide: CONFIGURACION_SINCRONIZACION,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<VariablesEntorno, true>,
      ): ConfiguracionSincronizacion => ({
        horaNocturna: config.get('SINCRONIZACION_HORA_NOCTURNA', {
          infer: true,
        }),
        secreto: config.get('SINCRONIZACION_SECRETO', { infer: true }),
      }),
    },
    { provide: RELOJ, useValue: (() => new Date()) satisfies Reloj },
  ],
  exports: [ServicioSincronizacion, ProgramadorSincronizacion],
})
export class ModuloSincronizacion {}
