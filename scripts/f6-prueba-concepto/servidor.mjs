// Prueba de concepto TEMPORAL de F6, paso 0 (plan aprobado por Ivan). Se
// retira antes del PR. No forma parte de DETECTA: solo comprueba en Render
// lo que su documentación no garantiza:
//   1. que la reescritura /api/* del sitio estático reenvía Cookie y
//      Set-Cookie y quita el prefijo;
//   2. que el servicio corre con Node 26;
//   3. que el puerto 2525 de Brevo admite STARTTLS desde el plan gratuito
//      (Render bloquea 25, 465 y 587).
// Sin dependencias, sin secretos y sin autenticación SMTP: solo EHLO,
// STARTTLS, el saludo TLS y QUIT.
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { connect as conectarTcp } from 'node:net';
import { connect as conectarTls } from 'node:tls';

const HOST_SMTP = 'smtp-relay.brevo.com';
const PLAZO_SMTP_MS = 8000;
const COOKIE = 'poc_sesion';

function responderJson(respuesta, estado, cuerpo, cabeceras = {}) {
  respuesta.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...cabeceras,
  });
  respuesta.end(JSON.stringify(cuerpo));
}

function leerCuerpo(peticion) {
  return new Promise((resolver) => {
    let longitud = 0;
    peticion.on('data', (trozo) => {
      longitud += trozo.length;
    });
    peticion.on('end', () => resolver(longitud));
  });
}

// Lee respuestas SMTP completas (la última línea lleva espacio tras el código).
function esperarRespuesta(socket) {
  return new Promise((resolver, rechazar) => {
    let acumulado = '';
    const alRecibir = (datos) => {
      acumulado += datos.toString('latin1');
      const lineas = acumulado.split('\r\n').filter(Boolean);
      const ultima = lineas.at(-1) ?? '';
      if (/^\d{3} /.test(ultima)) {
        socket.off('data', alRecibir);
        resolver(ultima.slice(0, 3));
      }
    };
    socket.on('data', alRecibir);
    socket.once('error', rechazar);
  });
}

async function probarPuerto(puerto) {
  const inicio = Date.now();
  const pasos = [];
  const socket = conectarTcp({ host: HOST_SMTP, port: puerto });
  socket.setTimeout(PLAZO_SMTP_MS, () =>
    socket.destroy(new Error('tiempo agotado')),
  );
  try {
    await new Promise((resolver, rechazar) => {
      socket.once('connect', resolver);
      socket.once('error', rechazar);
    });
    pasos.push(`conexion TCP; saludo ${await esperarRespuesta(socket)}`);
    socket.write('EHLO prueba-concepto.invalid\r\n');
    pasos.push(`EHLO ${await esperarRespuesta(socket)}`);
    socket.write('STARTTLS\r\n');
    pasos.push(`STARTTLS ${await esperarRespuesta(socket)}`);
    const tls = conectarTls({ socket, servername: HOST_SMTP, minVersion: 'TLSv1.2' });
    await new Promise((resolver, rechazar) => {
      tls.once('secureConnect', resolver);
      tls.once('error', rechazar);
    });
    pasos.push(`TLS ${tls.getProtocol()}, certificado valido: ${tls.authorized}`);
    tls.write('QUIT\r\n');
    tls.end();
    return { puerto, exito: true, pasos, ms: Date.now() - inicio };
  } catch (error) {
    socket.destroy();
    return { puerto, exito: false, pasos, error: error.message, ms: Date.now() - inicio };
  }
}

const rutas = {
  'GET /poc/version': (peticion, respuesta) =>
    responderJson(respuesta, 200, { node: process.version }),
  'POST /poc/cookie': (peticion, respuesta) =>
    responderJson(respuesta, 200, { origen: peticion.headers.origin ?? null }, {
      // Misma política que la cookie de sesión de DETECTA.
      'Set-Cookie': `${COOKIE}=${randomBytes(16).toString('hex')}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=600`,
    }),
  'GET /poc/estado': (peticion, respuesta) =>
    responderJson(respuesta, 429, { mensaje: 'prueba' }, { 'Retry-After': '42' }),
  'GET /poc/smtp': async (peticion, respuesta) =>
    responderJson(respuesta, 200, await Promise.all([2525, 587].map(probarPuerto))),
};

async function eco(peticion, respuesta) {
  const cookies = peticion.headers.cookie ?? '';
  responderJson(respuesta, 200, {
    metodo: peticion.method,
    ruta: peticion.url,
    bytesCuerpo: await leerCuerpo(peticion),
    cookieRecibida: cookies.split(';').some((c) => c.trim().startsWith(`${COOKIE}=`)),
    origen: peticion.headers.origin ?? null,
    hayXForwardedFor: peticion.headers['x-forwarded-for'] !== undefined,
    ipSocket: peticion.socket.remoteAddress,
  });
}

createServer((peticion, respuesta) => {
  const ruta = (peticion.url ?? '/').split('?')[0];
  if (ruta === '/poc/eco') {
    void eco(peticion, respuesta);
    return;
  }
  const manejador = rutas[`${peticion.method} ${ruta}`];
  if (!manejador) {
    responderJson(respuesta, 404, { ruta: peticion.url });
    return;
  }
  void manejador(peticion, respuesta);
}).listen(Number(process.env.PORT ?? 10000));
