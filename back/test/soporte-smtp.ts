import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import {
  createServer,
  type AddressInfo,
  type Server,
  type Socket,
} from 'node:net';
import { SMTPServer } from 'smtp-server';
import {
  ProveedorCorreoExterno,
  type OpcionesProveedorCorreoExterno,
} from '../src/integracion/proveedor-correo-externo';

/*
 * Soporte de las pruebas del adaptador SMTP (B5, respuesta 10 y ajuste E):
 * un servidor SMTP local (smtp-server, puerto 0) con STARTTLS y un
 * certificado autofirmado generado en memoria al ejecutar las pruebas. El
 * adaptador confía en él mediante la CA inyectada (`ca`); la verificación
 * del certificado nunca se desactiva. Ninguna clave se versiona.
 */

export const USUARIO_SMTP = 'usuario-pruebas';
export const CLAVE_SMTP = 'clave-smtp-de-pruebas-1234';

// --- Certificado X.509 autofirmado (DER mínimo, ECDSA P-256 + SHA-256) ---

function der(etiqueta: number, contenido: Buffer): Buffer {
  const largo = contenido.length;
  let cabecera: Buffer;
  if (largo < 0x80) {
    cabecera = Buffer.from([etiqueta, largo]);
  } else if (largo < 0x100) {
    cabecera = Buffer.from([etiqueta, 0x81, largo]);
  } else {
    cabecera = Buffer.from([etiqueta, 0x82, largo >> 8, largo & 0xff]);
  }
  return Buffer.concat([cabecera, contenido]);
}

const secuencia = (...partes: Buffer[]) => der(0x30, Buffer.concat(partes));

function oid(texto: string): Buffer {
  const [a = 0, b = 0, ...resto] = texto.split('.').map(Number);
  const bytes = [40 * a + b];
  for (const valor of resto) {
    const grupo = [valor & 0x7f];
    for (let v = valor >> 7; v > 0; v >>= 7) {
      grupo.unshift((v & 0x7f) | 0x80);
    }
    bytes.push(...grupo);
  }
  return der(0x06, Buffer.from(bytes));
}

function utcTime(fecha: Date): Buffer {
  const texto = fecha.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z';
  return der(0x17, Buffer.from(texto, 'ascii'));
}

const nombreLocalhost = () =>
  secuencia(
    der(0x31, secuencia(oid('2.5.4.3'), der(0x0c, Buffer.from('localhost')))),
  );

export interface CertificadoPrueba {
  clave: string;
  certificado: string;
}

/** Certificado de servidor para localhost y 127.0.0.1, válido 1 día. */
export function generarCertificadoPrueba(): CertificadoPrueba {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const algoritmo = secuencia(oid('1.2.840.10045.4.3.2'));
  const ahora = Date.now();
  const nombresAlternativos = secuencia(
    der(0x82, Buffer.from('localhost')),
    der(0x87, Buffer.from([127, 0, 0, 1])),
  );
  const extensiones = der(
    0xa3,
    secuencia(
      secuencia(oid('2.5.29.17'), der(0x04, nombresAlternativos)),
      secuencia(
        oid('2.5.29.19'),
        der(0x01, Buffer.from([0xff])),
        der(0x04, secuencia(der(0x01, Buffer.from([0xff])))),
      ),
    ),
  );
  const tbs = secuencia(
    der(0xa0, der(0x02, Buffer.from([2]))),
    der(0x02, Buffer.from([0x01, ...Array.from({ length: 8 }, () => 7)])),
    algoritmo,
    nombreLocalhost(),
    secuencia(
      utcTime(new Date(ahora - 3_600_000)),
      utcTime(new Date(ahora + 86_400_000)),
    ),
    nombreLocalhost(),
    publicKey.export({ type: 'spki', format: 'der' }),
    extensiones,
  );
  const firma = sign('sha256', tbs, { key: privateKey, dsaEncoding: 'der' });
  const certificado = secuencia(
    tbs,
    algoritmo,
    der(0x03, Buffer.concat([Buffer.from([0]), firma])),
  );
  const base64 = certificado.toString('base64').replace(/(.{64})/g, '$1\n');
  return {
    clave: createPrivateKey(privateKey.export({ type: 'pkcs8', format: 'pem' }))
      .export({ type: 'pkcs8', format: 'pem' })
      .toString(),
    certificado: `-----BEGIN CERTIFICATE-----\n${base64.trimEnd()}\n-----END CERTIFICATE-----\n`,
  };
}

// --- Servidor SMTP local ---

export interface MensajeRecibido {
  /** El mensaje se recibió sobre TLS (STARTTLS). */
  seguro: boolean;
  usuario: string | undefined;
  destinatarios: string[];
  /** Mensaje MIME tal como llegó. */
  crudo: string;
}

export interface OpcionesServidorSmtp {
  /** Código y texto con que rechazar el mensaje tras DATA (p. ej. 550). */
  rechazarDatos?: (crudo: string) => { codigo: number; texto: string } | null;
}

export interface ServidorSmtpPrueba {
  puerto: number;
  recibidos: MensajeRecibido[];
  cerrar(): Promise<void>;
}

export async function levantarServidorSmtp(
  certificado: CertificadoPrueba,
  opciones: OpcionesServidorSmtp = {},
): Promise<ServidorSmtpPrueba> {
  const recibidos: MensajeRecibido[] = [];
  const servidor = new SMTPServer({
    secure: false,
    key: certificado.clave,
    cert: certificado.certificado,
    minVersion: 'TLSv1.2',
    // Por defecto la autenticación solo se admite tras STARTTLS.
    authMethods: ['PLAIN', 'LOGIN'],
    disableReverseLookup: true,
    logger: false,
    onAuth(auth, _sesion, responder) {
      if (auth.username === USUARIO_SMTP && auth.password === CLAVE_SMTP) {
        responder(null, { user: auth.username });
        return;
      }
      responder(
        Object.assign(new Error('Credenciales inválidas'), {
          responseCode: 535,
        }),
      );
    },
    onData(flujo, sesion, responder) {
      const partes: Buffer[] = [];
      flujo.on('data', (parte: Buffer) => partes.push(parte));
      flujo.on('end', () => {
        const crudo = Buffer.concat(partes).toString('utf8');
        const rechazo = opciones.rechazarDatos?.(crudo) ?? null;
        if (rechazo !== null) {
          responder(
            Object.assign(new Error(rechazo.texto), {
              responseCode: rechazo.codigo,
            }),
          );
          return;
        }
        recibidos.push({
          seguro: sesion.secure,
          usuario: sesion.user,
          destinatarios: sesion.envelope.rcptTo.map((r) => r.address),
          crudo,
        });
        responder();
      });
    },
  });
  await new Promise<void>((resolver) =>
    servidor.listen(0, '127.0.0.1', resolver),
  );
  const { port } = servidor.server.address() as AddressInfo;
  return {
    puerto: port,
    recibidos,
    cerrar: () =>
      new Promise<void>((resolver) => servidor.close(() => resolver())),
  };
}

/**
 * Servidor que acepta la conexión, saluda tarde (`saludoMs`) y después no
 * responde nunca: con los temporizadores por etapa de nodemailer el envío
 * duraría saludo + socket; el plazo global debe cortarlo a los 5 s (ajuste B).
 */
export async function levantarServidorMudo(
  saludoMs: number,
): Promise<{ puerto: number; cerrar(): Promise<void> }> {
  const sockets = new Set<Socket>();
  const servidor: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
    socket.on('close', () => sockets.delete(socket));
    const temporizador = setTimeout(() => {
      if (!socket.destroyed) {
        socket.write('220 localhost ESMTP\r\n');
      }
    }, saludoMs);
    socket.on('close', () => clearTimeout(temporizador));
  });
  await new Promise<void>((resolver) =>
    servidor.listen(0, '127.0.0.1', resolver),
  );
  const { port } = servidor.address() as AddressInfo;
  return {
    puerto: port,
    cerrar: () =>
      new Promise<void>((resolver) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        servidor.close(() => resolver());
      }),
  };
}

/** Adaptador real apuntando al servidor local, con la CA de prueba. */
export function proveedorPrueba(
  puerto: number,
  certificado: CertificadoPrueba | null,
  cambios: Partial<OpcionesProveedorCorreoExterno> = {},
): ProveedorCorreoExterno {
  return new ProveedorCorreoExterno({
    // IP del SAN del certificado: evita que "localhost" resuelva a ::1.
    host: '127.0.0.1',
    puerto,
    usuario: USUARIO_SMTP,
    clave: CLAVE_SMTP,
    remitente: 'detecta@ejemplo.test',
    remitenteNombre: 'DETECTA',
    ...(certificado === null ? {} : { ca: certificado.certificado }),
    ...cambios,
  });
}

/** Decodifica quoted-printable (cuerpo HTML que codifica nodemailer). */
export function decodificarQuotedPrintable(texto: string): string {
  const bytes = texto
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  return Buffer.from(bytes, 'latin1').toString('utf8');
}
