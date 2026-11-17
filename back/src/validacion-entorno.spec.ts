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
};

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
