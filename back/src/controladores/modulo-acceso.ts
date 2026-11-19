import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import {
  CONFIGURACION_AUTENTICACION,
  RELOJ,
  ServicioAutenticacion,
  type ConfiguracionAutenticacion,
  type Reloj,
} from '../aplicacion/servicios/servicio-autenticacion';
import type { VariablesEntorno } from '../validacion-entorno';
import {
  CONFIGURACION_COOKIE,
  ControladorAcceso,
  type ConfiguracionCookie,
} from './controlador-acceso';
import { GuardSesion } from './guard-sesion';

type Configuracion = ConfigService<VariablesEntorno, true>;

/**
 * Autenticación y control de acceso (fase B3). Los repositorios y el
 * ProveedorCorreo llegan por token desde los módulos globales de persistencia
 * e integración: este módulo no importa código de esas capas (nota del
 * diagrama de paquetes).
 *
 * GuardSesion es global (APP_GUARD): toda ruta exige sesión salvo las
 * marcadas con @Publico().
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: Configuracion) => ({
        secret: config.get('JWT_SECRETO', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [ControladorAcceso],
  providers: [
    ServicioAutenticacion,
    ControlAcceso,
    { provide: APP_GUARD, useClass: GuardSesion },
    {
      provide: CONFIGURACION_AUTENTICACION,
      inject: [ConfigService],
      useFactory: (config: Configuracion): ConfiguracionAutenticacion => ({
        bcryptCosto: config.get('BCRYPT_COSTO', { infer: true }),
        activacionDuracionMin: config.get('ACTIVACION_DURACION_MIN', {
          infer: true,
        }),
        urlFrontend: config.get('URL_FRONTEND', { infer: true }),
      }),
    },
    {
      provide: CONFIGURACION_COOKIE,
      inject: [ConfigService],
      useFactory: (config: Configuracion): ConfiguracionCookie => ({
        segura: config.get('COOKIE_SEGURA', { infer: true }),
        duracionMin: config.get('SESION_DURACION_MIN', { infer: true }),
      }),
    },
    { provide: RELOJ, useValue: (() => new Date()) satisfies Reloj },
  ],
  // RELOJ: B7 lo reutiliza (reloj inyectable, ajuste C del plan de B7).
  exports: [ServicioAutenticacion, ControlAcceso, JwtModule, RELOJ],
})
export class ModuloAcceso {}
