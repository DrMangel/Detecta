import { X509Certificate } from 'node:crypto';
import { ErrorEnvioCorreo } from '../../src/aplicacion/contratos/proveedor-correo';
import {
  PLAZO_ENVIO_MS,
  type ProveedorCorreoExterno,
} from '../../src/integracion/proveedor-correo-externo';
import {
  CLAVE_SMTP,
  decodificarQuotedPrintable,
  generarCertificadoPrueba,
  levantarServidorMudo,
  levantarServidorSmtp,
  proveedorPrueba,
  USUARIO_SMTP,
  type CertificadoPrueba,
  type ServidorSmtpPrueba,
} from '../soporte-smtp';

/*
 * ProveedorCorreoExterno contra un servidor SMTP local real (B5, respuesta
 * 10): STARTTLS con verificación del certificado, autenticación, rechazos
 * del servidor y plazo global de 5 s (ajuste B).
 */

const CUERPO = '<p>Hola, Ana.</p>';

async function capturarError(
  promesa: Promise<unknown>,
): Promise<ErrorEnvioCorreo> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(ErrorEnvioCorreo);
    return error as ErrorEnvioCorreo;
  }
  throw new Error('se esperaba un ErrorEnvioCorreo');
}

let certificado: CertificadoPrueba;
let servidor: ServidorSmtpPrueba;
const proveedores: ProveedorCorreoExterno[] = [];

function proveedor(
  ...argumentos: Parameters<typeof proveedorPrueba>
): ProveedorCorreoExterno {
  const nuevo = proveedorPrueba(...argumentos);
  proveedores.push(nuevo);
  return nuevo;
}

beforeAll(async () => {
  certificado = generarCertificadoPrueba();
  servidor = await levantarServidorSmtp(certificado, {
    rechazarDatos: (crudo) =>
      crudo.includes('rechazar@ejemplo.test')
        ? { codigo: 550, texto: 'Buzón no disponible' }
        : null,
  });
});

afterEach(() => {
  for (const actual of proveedores.splice(0)) {
    actual.onModuleDestroy();
  }
});

afterAll(async () => {
  await servidor.cerrar();
});

describe('ProveedorCorreoExterno con un servidor SMTP local (B5)', () => {
  it('el certificado de prueba es válido para 127.0.0.1 y localhost', () => {
    const x509 = new X509Certificate(certificado.certificado);
    expect(x509.checkIP('127.0.0.1')).toBe('127.0.0.1');
    expect(x509.checkHost('localhost')).toBe('localhost');
  });

  it('envía por STARTTLS, autenticado, con remitente, asunto y cuerpo HTML', async () => {
    servidor.recibidos.length = 0;
    await expect(
      proveedor(servidor.puerto, certificado).enviar(
        'ana@ejemplo.edu.co',
        'DETECTA: cita programada',
        CUERPO,
      ),
    ).resolves.toBe(true);

    expect(servidor.recibidos).toHaveLength(1);
    const [mensaje] = servidor.recibidos;
    expect(mensaje?.seguro).toBe(true);
    expect(mensaje?.usuario).toBe(USUARIO_SMTP);
    expect(mensaje?.destinatarios).toEqual(['ana@ejemplo.edu.co']);
    const crudo = mensaje?.crudo ?? '';
    expect(crudo).toMatch(/^From: DETECTA <detecta@ejemplo\.test>$/m);
    expect(crudo).toMatch(/^Subject: DETECTA: cita programada$/m);
    expect(crudo).toMatch(/^Content-Type: text\/html; charset=utf-8$/m);
    expect(decodificarQuotedPrintable(crudo)).toContain(CUERPO);
  });

  it('sin la CA de prueba el certificado no se acepta: la verificación siempre está activa (ajuste E)', async () => {
    servidor.recibidos.length = 0;
    const error = await capturarError(
      proveedor(servidor.puerto, null).enviar(
        'ana@ejemplo.edu.co',
        'Asunto',
        CUERPO,
      ),
    );
    // Mismo servidor y puerto que la prueba anterior: solo cambia la CA, así
    // que el fallo de socket es el rechazo del certificado autofirmado.
    expect(error.codigo).toBe('ESOCKET');
    expect(servidor.recibidos).toHaveLength(0);
  });

  it('credenciales rechazadas: EAUTH 535, sin la clave en el error', async () => {
    const error = await capturarError(
      proveedor(servidor.puerto, certificado, { clave: 'otra-clave' }).enviar(
        'ana@ejemplo.edu.co',
        'Asunto',
        CUERPO,
      ),
    );
    expect(error).toMatchObject({ codigo: 'EAUTH', codigoRespuesta: 535 });
    const serializado = `${error.message} ${error.stack ?? ''} ${JSON.stringify(error)}`;
    expect(serializado).not.toContain('otra-clave');
    expect(serializado).not.toContain(CLAVE_SMTP);
    expect(serializado).not.toContain('Credenciales inválidas');
  });

  it('mensaje rechazado por el servidor: código 550 sin el texto ni el destinatario', async () => {
    const error = await capturarError(
      proveedor(servidor.puerto, certificado).enviar(
        'rechazar@ejemplo.test',
        'Asunto',
        CUERPO,
      ),
    );
    expect(error.codigoRespuesta).toBe(550);
    expect(error.message).toMatch(/^Error de envío \([A-Z_]+ 550\)$/);
    expect(`${error.message} ${error.stack ?? ''}`).not.toMatch(
      /rechazar@|Buzón/,
    );
  });

  it('plazo global de 5 s con un servidor que no responde (ajuste B)', async () => {
    // Saluda a los 3 s y luego calla: por etapas serían 3 s + 5 s = 8 s.
    const mudo = await levantarServidorMudo(3000);
    try {
      const inicio = Date.now();
      const error = await capturarError(
        proveedor(mudo.puerto, certificado).enviar(
          'ana@ejemplo.edu.co',
          'Asunto',
          CUERPO,
        ),
      );
      const duracion = Date.now() - inicio;
      expect(error.codigo).toBe('PLAZO_AGOTADO');
      expect(duracion).toBeGreaterThanOrEqual(PLAZO_ENVIO_MS - 50);
      expect(duracion).toBeLessThan(PLAZO_ENVIO_MS + 1000);
    } finally {
      await mudo.cerrar();
    }
  }, 15_000);
});
