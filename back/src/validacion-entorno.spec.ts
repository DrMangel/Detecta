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
};

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
