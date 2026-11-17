import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarAplicacion } from './configurar-aplicacion';
import type { VariablesEntorno } from './validacion-entorno';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configurarAplicacion(app);

  const config = app.get<ConfigService<VariablesEntorno, true>>(ConfigService);
  await app.listen(config.get('PUERTO', { infer: true }));
}

void iniciar();
