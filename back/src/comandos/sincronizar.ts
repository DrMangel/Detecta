import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ServicioSincronizacion } from '../aplicacion/servicios/servicio-sincronizacion';

/*
 * Disparo manual de la sincronización por línea de comandos (respuesta 8 de
 * Ivan; ER Tabla 2: "orden manual emitida por el administrador por fuera de
 * la aplicación"). Usa el mismo ServicioSincronizacion que la ruta HTTP y la
 * tarea nocturna.
 *
 * Uso (desde back/, tras `npm run build`):
 *   npm run sincronizar                       (todos los cursos configurados)
 *   npm run sincronizar -- --curso ISOF-101   (un curso)
 */
async function principal(argumentos: string[]): Promise<void> {
  const indice = argumentos.indexOf('--curso');
  const idCurso = indice === -1 ? null : argumentos[indice + 1];
  if (indice !== -1 && !idCurso) {
    throw new Error('Uso: sincronizar [-- --curso <idCurso>]');
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const servicio = app.get(ServicioSincronizacion);
    if (idCurso) {
      await servicio.sincronizarCurso(idCurso);
    } else {
      await servicio.sincronizarTodo();
    }
    const resultado = servicio.obtenerUltimoResultado();
    for (const mensaje of resultado?.mensajes ?? []) {
      process.stdout.write(`${mensaje}\n`);
    }
    process.stdout.write(
      `Desglose de omisiones: ${JSON.stringify(resultado?.desglose ?? {})}\n`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  principal(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
