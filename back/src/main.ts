// Primera importación: fija UV_THREADPOOL_SIZE antes de que libuv cree sus
// hilos (B9, ajuste 3a). Ver hilos-libuv.ts.
import './hilos-libuv';
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProgramadorSincronizacion } from './aplicacion/servicios/programador-sincronizacion';
import { configurarAplicacion } from './configurar-aplicacion';
import type { VariablesEntorno } from './validacion-entorno';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configurarAplicacion(app);

  const config = app.get<ConfigService<VariablesEntorno, true>>(ConfigService);
  await app.listen(config.get('PUERTO', { infer: true }));
  // Solo el servidor programa la sincronización nocturna (B4); los comandos
  // de línea y las pruebas no la inician.
  app.get(ProgramadorSincronizacion).iniciar();
}

void iniciar();
