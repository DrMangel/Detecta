import { Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { ErrorEnvioCorreo } from '../aplicacion/contratos/proveedor-correo';
import {
  AVISO_CORREO_DESACTIVADO,
  ProveedorCorreoDesactivado,
} from './proveedor-correo-desactivado';
import {
  ProveedorCorreoExterno,
  sanear,
  type OpcionesProveedorCorreoExterno,
} from './proveedor-correo-externo';

const TOKEN = 'TokenSecreto_abcdefghijklmnopqrstuvwxyz0123456';
const CLAVE = 'clave-smtp-secreta';
const OPCIONES: OpcionesProveedorCorreoExterno = {
  host: 'smtp.ejemplo.test',
  puerto: 587,
  usuario: 'usuario',
  clave: CLAVE,
  remitente: 'detecta@ejemplo.test',
  remitenteNombre: 'DETECTA',
};

function transporte(sendMail: jest.Mock): Transporter {
  return { sendMail, close: jest.fn() } as unknown as Transporter;
}

async function capturarError(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('se esperaba un error');
}

describe('ProveedorCorreoExterno (B5)', () => {
  it('envía con el remitente configurado, el asunto y el cuerpo HTML', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
    const proveedor = new ProveedorCorreoExterno(
      OPCIONES,
      transporte(sendMail),
    );
    await expect(
      proveedor.enviar('ana@ejemplo.edu.co', 'Asunto', '<p>Hola</p>'),
    ).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: 'DETECTA', address: 'detecta@ejemplo.test' },
      to: 'ana@ejemplo.edu.co',
      subject: 'Asunto',
      html: '<p>Hola</p>',
    });
  });

  it.each(['Asunto\r\nBcc: x@y.z', 'Asunto\nX', 'Asunto\rX'])(
    'rechaza un asunto con saltos de línea sin llamar al transporte (ajuste C): %j',
    async (asunto) => {
      const sendMail = jest.fn();
      const proveedor = new ProveedorCorreoExterno(
        OPCIONES,
        transporte(sendMail),
      );
      const error = await capturarError(
        proveedor.enviar('ana@ejemplo.edu.co', asunto, '<p>x</p>'),
      );
      expect(error).toBeInstanceOf(ErrorEnvioCorreo);
      expect((error as ErrorEnvioCorreo).codigo).toBe('ASUNTO_INVALIDO');
      expect(sendMail).not.toHaveBeenCalled();
    },
  );

  it('en demo rechaza destinatarios @ejemplo.invalid antes del transporte', async () => {
    const sendMail = jest.fn();
    const proveedor = new ProveedorCorreoExterno(
      { ...OPCIONES, rechazarEjemploInvalid: true },
      transporte(sendMail),
    );
    const error = await capturarError(
      proveedor.enviar('estudiante@ejemplo.invalid', 'Asunto', '<p>x</p>'),
    );
    expect(error).toBeInstanceOf(ErrorEnvioCorreo);
    expect((error as ErrorEnvioCorreo).codigo).toBe(
      'DESTINATARIO_NO_PERMITIDO',
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each([
    'otra.persona@gmail.com',
    'detectasoportetecnico@gmail.com',
    'detectasoportetecnico+est01@gmail.com.ejemplo.test',
    'detectasoportetecnico+est01@ejemplo.edu.co',
  ])(
    'en demo rechaza destinatarios fuera del patrón permitido antes del transporte: %s',
    async (destino) => {
      const sendMail = jest.fn();
      const proveedor = new ProveedorCorreoExterno(
        { ...OPCIONES, destinoPermitido: 'detectasoportetecnico+*@gmail.com' },
        transporte(sendMail),
      );
      const error = await capturarError(
        proveedor.enviar(destino, 'Asunto', '<p>x</p>'),
      );
      expect(error).toBeInstanceOf(ErrorEnvioCorreo);
      expect((error as ErrorEnvioCorreo).codigo).toBe(
        'DESTINATARIO_NO_PERMITIDO',
      );
      expect(sendMail).not.toHaveBeenCalled();
    },
  );

  it.each([
    'detectasoportetecnico+est01@gmail.com',
    ' DetectaSoporteTecnico+JEFE@Gmail.com ',
  ])(
    'en demo envía a destinatarios que cumplen el patrón permitido: %j',
    async (destino) => {
      const sendMail = jest.fn().mockResolvedValue({ messageId: 'x' });
      const proveedor = new ProveedorCorreoExterno(
        { ...OPCIONES, destinoPermitido: 'detectasoportetecnico+*@gmail.com' },
        transporte(sendMail),
      );
      await expect(
        proveedor.enviar(destino, 'Asunto', '<p>x</p>'),
      ).resolves.toBe(true);
      expect(sendMail).toHaveBeenCalledTimes(1);
    },
  );

  it('plazo global: un transporte que no responde se corta al vencer el plazo (ajuste B)', async () => {
    const proveedor = new ProveedorCorreoExterno(
      { ...OPCIONES, plazoMs: 200 },
      transporte(jest.fn().mockReturnValue(new Promise(() => undefined))),
    );
    const inicio = Date.now();
    const error = await capturarError(
      proveedor.enviar('ana@ejemplo.edu.co', 'Asunto', '<p>x</p>'),
    );
    expect((error as ErrorEnvioCorreo).codigo).toBe('PLAZO_AGOTADO');
    expect(Date.now() - inicio).toBeLessThan(1000);
  });

  it('nunca propaga el error del transporte: ni token, ni destinatario, ni clave', async () => {
    const original = Object.assign(
      new Error(
        `550 rechazado para ana@ejemplo.edu.co: <a href="/activar#token=${TOKEN}"> clave ${CLAVE}`,
      ),
      { code: 'EENVELOPE', responseCode: 550, response: `550 ${TOKEN}` },
    );
    const proveedor = new ProveedorCorreoExterno(
      OPCIONES,
      transporte(jest.fn().mockRejectedValue(original)),
    );
    const error = await capturarError(
      proveedor.enviar('ana@ejemplo.edu.co', 'Asunto', `#token=${TOKEN}`),
    );
    expect(error).toBeInstanceOf(ErrorEnvioCorreo);
    expect(error).toMatchObject({ codigo: 'EENVELOPE', codigoRespuesta: 550 });
    const serializado = `${String(error)} ${JSON.stringify(error)} ${(error as Error).stack ?? ''}`;
    for (const secreto of [TOKEN, CLAVE, 'ana@ejemplo.edu.co']) {
      expect(serializado).not.toContain(secreto);
    }
    expect((error as Error).message).toBe('Error de envío (EENVELOPE 550)');
  });

  it('sanear descarta códigos que no son identificadores técnicos', () => {
    expect(sanear({ code: `X${TOKEN}` }).codigo).toBe('DESCONOCIDO');
    expect(sanear({ code: 'EAUTH', responseCode: 535 })).toMatchObject({
      codigo: 'EAUTH',
      codigoRespuesta: 535,
    });
    expect(sanear({ responseCode: '535' }).codigoRespuesta).toBeUndefined();
    expect(sanear(null).codigo).toBe('DESCONOCIDO');
  });

  it('onModuleDestroy cierra el pool', () => {
    const cerrar = jest.fn();
    const proveedor = new ProveedorCorreoExterno(OPCIONES, {
      sendMail: jest.fn(),
      close: cerrar,
    } as unknown as Transporter);
    proveedor.onModuleDestroy();
    expect(cerrar).toHaveBeenCalledTimes(1);
  });
});

describe('ProveedorCorreoDesactivado (CORREO_MODO=desactivado)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('avisa al arrancar, no envía y no registra contenido', async () => {
    const registro: string[] = [];
    for (const nivel of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest
        .spyOn(Logger.prototype, nivel)
        .mockImplementation((...[mensaje]: unknown[]) => {
          registro.push(String(mensaje));
        });
    }
    const proveedor = new ProveedorCorreoDesactivado();
    expect(registro).toEqual([AVISO_CORREO_DESACTIVADO]);

    await expect(
      proveedor.enviar('ana@ejemplo.edu.co', 'Asunto', `#token=${TOKEN}`),
    ).resolves.toBe(false);
    expect(registro).toEqual([AVISO_CORREO_DESACTIVADO]);
  });
});
