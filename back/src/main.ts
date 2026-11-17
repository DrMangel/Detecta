import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { VariablesEntorno } from './validacion-entorno';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Cierra las conexiones a la base de datos al detener el proceso.
  app.enableShutdownHooks();

  const config = app.get<ConfigService<VariablesEntorno, true>>(ConfigService);
  await app.listen(config.get('PUERTO', { infer: true }));
}

void iniciar();
