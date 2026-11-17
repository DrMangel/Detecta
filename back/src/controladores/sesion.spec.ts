import { leerCookie } from './sesion';

describe('leerCookie', () => {
  it('lee la cookie pedida entre varias', () => {
    expect(
      leerCookie('a=1; detecta_sesion=abc.def; b=2', 'detecta_sesion'),
    ).toBe('abc.def');
  });

  it('devuelve undefined si falta la cabecera o la cookie', () => {
    expect(leerCookie(undefined, 'detecta_sesion')).toBeUndefined();
    expect(leerCookie('otra=1', 'detecta_sesion')).toBeUndefined();
  });

  it('no confunde un nombre que solo empieza igual', () => {
    expect(leerCookie('detecta_sesion_x=1', 'detecta_sesion')).toBeUndefined();
  });

  it('devuelve undefined si el valor está mal codificado', () => {
    expect(
      leerCookie('detecta_sesion=%E0%A4%A', 'detecta_sesion'),
    ).toBeUndefined();
  });

  it('acepta la cabecera como arreglo', () => {
    expect(leerCookie(['a=1', 'detecta_sesion=x'], 'detecta_sesion')).toBe('x');
  });
});
