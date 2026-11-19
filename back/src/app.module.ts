import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ESQUEMAS } from './persistencia/esquemas';
import { ModuloAcceso } from './controladores/modulo-acceso';
import { ModuloAlertasSolicitudes } from './controladores/modulo-alertas-solicitudes';
import { ModuloCasosAtencion } from './controladores/modulo-casos-atencion';
import { ModuloPlanesInformes } from './controladores/modulo-planes-informes';
import { ModuloSincronizacion } from './controladores/modulo-sincronizacion';
import { ModuloIntegracion } from './integracion/modulo-integracion';
import { ModuloNotificacion } from './controladores/modulo-notificacion';
import { ModuloPersistencia } from './persistencia/modulo-persistencia';
import { validarEntorno, VariablesEntorno } from './validacion-entorno';

import {
  CONEXION_INSTITUCIONAL,
  TIEMPO_CONEXION_INSTITUCIONAL_MS,
} from './conexiones';

export { CONEXION_INSTITUCIONAL } from './conexiones';

/** Reintentos cortos para que un error de conexión se detecte rápido al arrancar. */
const REINTENTOS_CONEXION = 2;
const ESPERA_ENTRE_REINTENTOS_MS = 1000;

/**
 * Módulo raíz. Carga la configuración y abre las dos conexiones a
 * PostgreSQL (B0). La conexión `detecta` registra los esquemas de
 * persistencia (B2); `synchronize` sigue desactivado: el esquema solo se
 * modifica con migraciones (`detecta_migrador`). El conector institucional
 * (`ConectorBDConfigurable`) se agrega en B4.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validarEntorno,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<VariablesEntorno, true>) => ({
        type: 'postgres',
        host: config.get('BD_DETECTA_HOST', { infer: true }),
        port: config.get('BD_DETECTA_PUERTO', { infer: true }),
        database: config.get('BD_DETECTA_NOMBRE', { infer: true }),
        username: config.get('BD_DETECTA_USUARIO', { infer: true }),
        password: config.get('BD_DETECTA_CONTRASENA', { infer: true }),
        entities: ESQUEMAS,
        synchronize: false,
        retryAttempts: REINTENTOS_CONEXION,
        retryDelay: ESPERA_ENTRE_REINTENTOS_MS,
        // B9 (ajuste 3b): tamaño del pool de pg configurable; 10 por defecto,
        // el mismo valor que pg usaba hasta B8.
        extra: { max: config.get('BD_DETECTA_POOL_MAX', { infer: true }) },
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: CONEXION_INSTITUCIONAL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<VariablesEntorno, true>) => ({
        name: CONEXION_INSTITUCIONAL,
        type: 'postgres',
        host: config.get('BD_INSTITUCIONAL_HOST', { infer: true }),
        port: config.get('BD_INSTITUCIONAL_PUERTO', { infer: true }),
        database: config.get('BD_INSTITUCIONAL_NOMBRE', { infer: true }),
        username: config.get('BD_INSTITUCIONAL_USUARIO', { infer: true }),
        password: config.get('BD_INSTITUCIONAL_CONTRASENA', { infer: true }),
        entities: [],
        synchronize: false,
        retryAttempts: REINTENTOS_CONEXION,
        retryDelay: ESPERA_ENTRE_REINTENTOS_MS,
        // Línea base §4: la conexión con la BD institucional es de solo
        // lectura. Además del usuario sin privilegios de escritura, cada
        // sesión se abre en modo de solo lectura.
        extra: {
          options: '-c default_transaction_read_only=on',
          // ER Tabla 2: conexión en menos de 5 s (B4).
          connectionTimeoutMillis: TIEMPO_CONEXION_INSTITUCIONAL_MS,
        },
      }),
    }),
    ModuloPersistencia,
    ModuloIntegracion,
    ModuloAcceso,
    ModuloSincronizacion,
    ModuloNotificacion,
    ModuloAlertasSolicitudes,
    ModuloCasosAtencion,
    ModuloPlanesInformes,
  ],
})
export class AppModule {}
