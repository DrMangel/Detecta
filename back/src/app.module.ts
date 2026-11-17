import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validarEntorno, VariablesEntorno } from './validacion-entorno';

/**
 * Nombre de la conexión a la base que simula la BD institucional.
 * La conexión por defecto (sin nombre) es la base propia `detecta`.
 */
export const CONEXION_INSTITUCIONAL = 'institucional';

/** Reintentos cortos para que un error de conexión se detecte rápido al arrancar. */
const REINTENTOS_CONEXION = 2;
const ESPERA_ENTRE_REINTENTOS_MS = 1000;

/**
 * Módulo raíz (fase B0). Solo carga la configuración y abre las dos conexiones
 * a PostgreSQL. Las entidades, el mapeo y las migraciones se agregan en B2, y
 * el conector institucional (`ConectorBDConfigurable`) en B4. Por eso aquí
 * `entities` está vacío y `synchronize` desactivado: el esquema solo se
 * modificará mediante migraciones.
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
        entities: [],
        synchronize: false,
        retryAttempts: REINTENTOS_CONEXION,
        retryDelay: ESPERA_ENTRE_REINTENTOS_MS,
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
        extra: { options: '-c default_transaction_read_only=on' },
      }),
    }),
  ],
})
export class AppModule {}
