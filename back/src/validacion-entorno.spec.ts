import { validarEntorno } from './validacion-entorno';

const entornoValido: Record<string, string> = {
  NODE_ENV: 'test',
  PUERTO: '3000',
  BD_DETECTA_HOST: 'localhost',
  BD_DETECTA_PUERTO: '5432',
  BD_DETECTA_NOMBRE: 'detecta',
  BD_DETECTA_USUARIO: 'usuario',
  BD_DETECTA_CONTRASENA: 'clave',
  BD_INSTITUCIONAL_HOST: 'localhost',
  BD_INSTITUCIONAL_PUERTO: '5432',
  BD_INSTITUCIONAL_NOMBRE: 'institucional_demo',
  BD_INSTITUCIONAL_USUARIO: 'lector',
  BD_INSTITUCIONAL_CONTRASENA: 'clave',
  JWT_SECRETO: 'x'.repeat(32),
  SESION_DURACION_MIN: '60',
  COOKIE_SEGURA: 'true',
  BCRYPT_COSTO: '12',
  ACTIVACION_DURACION_MIN: '30',
  URL_FRONTEND: 'http://localhost:5173/',
  CONECTOR_CONFIGURACION: 'conector-institucional.ejemplo.json',
  CORREO_SMTP_HOST: 'smtp.ejemplo.test',
  CORREO_SMTP_PUERTO: '587',
  CORREO_SMTP_USUARIO: 'usuario-smtp',
  CORREO_SMTP_CLAVE: 'clave-smtp',
  CORREO_REMITENTE: 'detecta@ejemplo.test',
  CORREO_REMITENTE_NOMBRE: 'DETECTA',
};

/** Entorno sin ninguna variable de correo. */
function sinCorreo(): Record<string, string> {
  const entorno = { ...entornoValido };
  for (const clave of Object.keys(entorno)) {
    if (clave.startsWith('CORREO_')) {
      delete entorno[clave];
    }
  }
  return entorno;
}

describe('validarEntorno: correo (B5)', () => {
  it('con la configuración SMTP completa el modo es smtp', () => {
    expect(validarEntorno(entornoValido).CORREO).toEqual({
      modo: 'smtp',
      host: 'smtp.ejemplo.test',
      puerto: 587,
      usuario: 'usuario-smtp',
      clave: 'clave-smtp',
      remitente: 'detecta@ejemplo.test',
      remitenteNombre: 'DETECTA',
    });
  });

  it('sin configuración SMTP la aplicación no arranca', () => {
    expect(() => validarEntorno(sinCorreo())).toThrow(
      /Falta la configuración SMTP \(CORREO_SMTP_HOST, CORREO_SMTP_PUERTO, CORREO_SMTP_USUARIO, CORREO_SMTP_CLAVE, CORREO_REMITENTE, CORREO_REMITENTE_NOMBRE\)/,
    );
    const sinClave = { ...entornoValido, CORREO_SMTP_CLAVE: '  ' };
    expect(() => validarEntorno(sinClave)).toThrow(/CORREO_SMTP_CLAVE/);
  });

  it('el mensaje de error nunca incluye la clave SMTP', () => {
    let mensaje = '';
    try {
      validarEntorno({ ...entornoValido, CORREO_SMTP_PUERTO: 'x' });
    } catch (error) {
      mensaje = (error as Error).message;
    }
    expect(mensaje).toMatch(/CORREO_SMTP_PUERTO debe ser un entero/);
    expect(mensaje).not.toContain('clave-smtp');
  });

  it('CORREO_MODO=desactivado arranca sin configuración SMTP', () => {
    expect(
      validarEntorno({ ...sinCorreo(), CORREO_MODO: 'desactivado' }).CORREO,
    ).toEqual({ modo: 'desactivado' });
  });

  it('CORREO_MODO=desactivado se rechaza con NODE_ENV=production', () => {
    expect(() =>
      validarEntorno({
        ...entornoValido,
        NODE_ENV: 'production',
        CORREO_MODO: 'desactivado',
      }),
    ).toThrow(/CORREO_MODO=desactivado no se admite en producción/);
  });

  it('rechaza otro modo, un remitente inválido y saltos de línea en el nombre', () => {
    expect(() =>
      validarEntorno({ ...entornoValido, CORREO_MODO: 'consola' }),
    ).toThrow(/CORREO_MODO debe ser smtp o desactivado/);
    expect(() =>
      validarEntorno({ ...entornoValido, CORREO_REMITENTE: 'no-es-correo' }),
    ).toThrow(/CORREO_REMITENTE debe ser un correo válido/);
    expect(() =>
      validarEntorno({
        ...entornoValido,
        CORREO_REMITENTE_NOMBRE: 'DETECTA\r\nBcc: x@y.z',
      }),
    ).toThrow(/CORREO_REMITENTE_NOMBRE no admite saltos de línea/);
  });
});

describe('validarEntorno: variables de sincronización (B4)', () => {
  it('la hora nocturna y el secreto son opcionales: vacíos quedan en null', () => {
    const resultado = validarEntorno({
      ...entornoValido,
      SINCRONIZACION_HORA_NOCTURNA: '',
      SINCRONIZACION_SECRETO: '',
    });
    expect(resultado.SINCRONIZACION_HORA_NOCTURNA).toBeNull();
    expect(resultado.SINCRONIZACION_SECRETO).toBeNull();
    expect(resultado.CONECTOR_CONFIGURACION).toBe(
      'conector-institucional.ejemplo.json',
    );
  });

  it('acepta HH:MM y rechaza otra forma de hora', () => {
    expect(
      validarEntorno({
        ...entornoValido,
        SINCRONIZACION_HORA_NOCTURNA: '02:00',
      }).SINCRONIZACION_HORA_NOCTURNA,
    ).toBe('02:00');
    expect(() =>
      validarEntorno({
        ...entornoValido,
        SINCRONIZACION_HORA_NOCTURNA: '24:00',
      }),
    ).toThrow(/HH:MM/);
  });

  it('rechaza un secreto de sincronización de menos de 32 caracteres', () => {
    expect(() =>
      validarEntorno({ ...entornoValido, SINCRONIZACION_SECRETO: 'corto' }),
    ).toThrow(/SINCRONIZACION_SECRETO debe tener al menos 32/);
  });

  it('exige CONECTOR_CONFIGURACION', () => {
    const sinConector = { ...entornoValido };
    delete sinConector['CONECTOR_CONFIGURACION'];
    expect(() => validarEntorno(sinConector)).toThrow(
      /CONECTOR_CONFIGURACION es obligatoria/,
    );
  });
});

describe('validarEntorno: variables de autenticación (B3)', () => {
  it('convierte los tipos y normaliza URL_FRONTEND a su origen', () => {
    const resultado = validarEntorno(entornoValido);
    expect(resultado.SESION_DURACION_MIN).toBe(60);
    expect(resultado.COOKIE_SEGURA).toBe(true);
    expect(resultado.BCRYPT_COSTO).toBe(12);
    expect(resultado.ACTIVACION_DURACION_MIN).toBe(30);
    expect(resultado.URL_FRONTEND).toBe('http://localhost:5173');
  });

  it('exige SESION_DURACION_MIN (sin valor por defecto, D14)', () => {
    const sinDuracion = { ...entornoValido };
    delete sinDuracion['SESION_DURACION_MIN'];
    expect(() => validarEntorno(sinDuracion)).toThrow(
      /SESION_DURACION_MIN debe ser un entero/,
    );
  });

  it('rechaza un JWT_SECRETO de menos de 32 caracteres', () => {
    expect(() =>
      validarEntorno({ ...entornoValido, JWT_SECRETO: 'corto' }),
    ).toThrow(/JWT_SECRETO debe tener al menos 32/);
  });

  it('exige COOKIE_SEGURA=true en producción', () => {
    expect(() =>
      validarEntorno({
        ...entornoValido,
        NODE_ENV: 'production',
        COOKIE_SEGURA: 'false',
      }),
    ).toThrow(/COOKIE_SEGURA debe ser true en producción/);
    expect(
      validarEntorno({ ...entornoValido, COOKIE_SEGURA: 'false' })
        .COOKIE_SEGURA,
    ).toBe(false);
  });

  it('rechaza un BCRYPT_COSTO fuera de 10 a 15 y una URL_FRONTEND inválida', () => {
    expect(() =>
      validarEntorno({ ...entornoValido, BCRYPT_COSTO: '4' }),
    ).toThrow(/BCRYPT_COSTO/);
    expect(() =>
      validarEntorno({ ...entornoValido, URL_FRONTEND: 'ftp://x' }),
    ).toThrow(/URL_FRONTEND/);
  });
});

describe('validarEntorno', () => {
  it('devuelve las variables tipadas cuando todas son válidas', () => {
    const resultado = validarEntorno(entornoValido);

    expect(resultado.PUERTO).toBe(3000);
    expect(resultado.BD_DETECTA_PUERTO).toBe(5432);
    expect(resultado.BD_INSTITUCIONAL_NOMBRE).toBe('institucional_demo');
    expect(resultado.NODE_ENV).toBe('test');
  });

  it('rechaza y lista todas las variables obligatorias que faltan', () => {
    const incompleto = { ...entornoValido };
    delete incompleto['BD_DETECTA_CONTRASENA'];
    incompleto['BD_INSTITUCIONAL_USUARIO'] = '   ';

    expect(() => validarEntorno(incompleto)).toThrow(
      /BD_DETECTA_CONTRASENA es obligatoria[\s\S]*BD_INSTITUCIONAL_USUARIO es obligatoria/,
    );
  });

  it('rechaza puertos que no son enteros entre 1 y 65535', () => {
    expect(() =>
      validarEntorno({ ...entornoValido, BD_DETECTA_PUERTO: '70000' }),
    ).toThrow(/BD_DETECTA_PUERTO debe ser un entero/);
    expect(() => validarEntorno({ ...entornoValido, PUERTO: 'abc' })).toThrow(
      /PUERTO debe ser un entero/,
    );
  });

  it('rechaza un NODE_ENV no permitido', () => {
    expect(() =>
      validarEntorno({ ...entornoValido, NODE_ENV: 'staging' }),
    ).toThrow(/NODE_ENV debe ser uno de/);
  });
});

describe('validarEntorno: hilos de libuv y pool de la base (B9)', () => {
  it('ambas son opcionales: por defecto 4 hilos y 10 conexiones', () => {
    const resultado = validarEntorno(entornoValido);

    expect(resultado.UV_THREADPOOL_SIZE).toBe(4);
    expect(resultado.BD_DETECTA_POOL_MAX).toBe(10);
  });

  it('acepta valores dentro del rango', () => {
    const resultado = validarEntorno({
      ...entornoValido,
      UV_THREADPOOL_SIZE: '128',
      BD_DETECTA_POOL_MAX: '20',
    });

    expect(resultado.UV_THREADPOOL_SIZE).toBe(128);
    expect(resultado.BD_DETECTA_POOL_MAX).toBe(20);
  });

  it.each([
    [
      'UV_THREADPOOL_SIZE',
      '0',
      /UV_THREADPOOL_SIZE es opcional; si se declara debe ser un entero entre 1 y 128/,
    ],
    ['UV_THREADPOOL_SIZE', '129', /UV_THREADPOOL_SIZE es opcional/],
    ['UV_THREADPOOL_SIZE', '4.5', /UV_THREADPOOL_SIZE es opcional/],
    [
      'BD_DETECTA_POOL_MAX',
      '0',
      /BD_DETECTA_POOL_MAX es opcional; si se declara debe ser un entero entre 1 y 50/,
    ],
    ['BD_DETECTA_POOL_MAX', 'diez', /BD_DETECTA_POOL_MAX es opcional/],
  ])('rechaza %s=%s', (clave, valor, mensaje) => {
    expect(() => validarEntorno({ ...entornoValido, [clave]: valor })).toThrow(
      mensaje,
    );
  });
});
