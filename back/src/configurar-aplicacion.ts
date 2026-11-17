import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VariablesEntorno } from './validacion-entorno';

/**
 * Configuración HTTP común a `main.ts` y a las pruebas e2e.
 *
 * CORS (ajuste D de Ivan): el front puede correr en otro origen (otro puerto)
 * y necesita enviar la cookie de sesión. Se admite SOLO el origen exacto de
 * URL_FRONTEND, con credenciales y sin comodines: con `credentials: true` un
 * comodín sería inseguro. La cookie es SameSite=Strict: localhost en otro
 * puerto sigue siendo el mismo sitio, así que el navegador la envía.
 */
export function configurarAplicacion(app: INestApplication): void {
  const config = app.get<ConfigService<VariablesEntorno, true>>(ConfigService);
  const origenPermitido = config.get('URL_FRONTEND', { infer: true });
  app.enableCors({
    // Función y no texto fijo: con texto fijo la cabecera
    // Access-Control-Allow-Origin se enviaría también a orígenes ajenos.
    origin: (
      origen: string | undefined,
      responder: (error: Error | null, permitir?: boolean) => void,
    ) => responder(null, origen === origenPermitido),
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  });
  // Cierra las conexiones a la base de datos al detener el proceso.
  app.enableShutdownHooks();
}
