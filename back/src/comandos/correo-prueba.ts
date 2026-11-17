import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  PROVEEDOR_CORREO,
  type ProveedorCorreo,
} from '../aplicacion/contratos/proveedor-correo';
import { MENSAJES_TABLA_1 } from '../aplicacion/servicios/servicio-notificacion';

/*
 * Correo real de prueba (criterio de cierre de B5: "Correo de prueba enviado
 * sin contenido confidencial"). Envía por el ProveedorCorreo configurado
 * (Brevo) un correo SIN datos del sistema.
 *
 * Uso (desde back/, tras `npm run build`, con las credenciales SMTP en
 * back/.env): npm run correo:prueba -- <destino>
 *
 * Nunca imprime la configuración SMTP ni la clave: solo "Correo enviado" o
 * "Error de envío (<código>)" (ER Tabla 1).
 */
const ASUNTO = 'DETECTA: correo de prueba';
const CUERPO = [
  '<!DOCTYPE html>',
  '<html lang="es">',
  '<head><meta charset="utf-8"><title>DETECTA</title></head>',
  '<body><p>Este es un correo de prueba de DETECTA. No contiene información del sistema.</p></body>',
  '</html>',
].join('\n');

async function principal(argumentos: string[]): Promise<void> {
  const [destino] = argumentos;
  if (!destino) {
    throw new Error('Uso: correo:prueba -- <destino>');
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const correo = app.get<ProveedorCorreo>(PROVEEDOR_CORREO);
    const aceptado = await correo.enviar(destino, ASUNTO, CUERPO);
    if (!aceptado) {
      throw new Error(
        `${MENSAJES_TABLA_1.error} (NO_ENVIADO: revise CORREO_MODO)`,
      );
    }
    process.stdout.write(`${MENSAJES_TABLA_1.enviado}\n`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  principal(process.argv.slice(2)).catch((error: unknown) => {
    // ErrorEnvioCorreo solo lleva códigos técnicos: su mensaje es seguro.
    process.stderr.write(
      `${error instanceof Error ? error.message : MENSAJES_TABLA_1.error}\n`,
    );
    process.exit(1);
  });
}
