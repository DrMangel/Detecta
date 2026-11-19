import { describe, expect, it } from 'vitest';
import {
  errorDeRed,
  errorDeRespuesta,
  leerRetryAfter,
  mensajeDeError,
  TEXTO_ERROR_GENERICO,
  TEXTO_ERROR_RED,
  TEXTO_SIN_PERMISO,
} from './errores';

describe('errorDeRespuesta: traducción uniforme por código', () => {
  it.each([
    [401, 'Sesión no válida o caducada'],
    [400, 'El campo correo es obligatorio'],
    [409, 'El caso ya fue canalizado'],
    [503, 'Error al consultar la información'],
  ])('%i: muestra el texto del backend', (estado, texto) => {
    const error = errorDeRespuesta(estado, { message: texto }, null);
    expect(error.estado).toBe(estado);
    expect(error.message).toBe(texto);
  });

  it('403: siempre el texto de F0, nunca el «Forbidden» del backend', () => {
    const error = errorDeRespuesta(
      403,
      { statusCode: 403, message: 'Forbidden' },
      null,
    );
    expect(error.message).toBe(TEXTO_SIN_PERMISO);
  });

  it('500: siempre el genérico, nunca el «Internal server error» de NestJS', () => {
    expect(
      errorDeRespuesta(
        500,
        { statusCode: 500, message: 'Internal server error' },
        null,
      ).message,
    ).toBe(TEXTO_ERROR_GENERICO);
  });

  it('503 sin texto, o un código no previsto: el genérico', () => {
    expect(errorDeRespuesta(503, null, null).message).toBe(
      TEXTO_ERROR_GENERICO,
    );
    expect(
      errorDeRespuesta(502, { message: 'Bad Gateway' }, null).message,
    ).toBe(TEXTO_ERROR_GENERICO);
  });

  it('429: el texto del backend y la espera de Retry-After en segundos', () => {
    const error = errorDeRespuesta(
      429,
      { message: 'Demasiados intentos. Intente de nuevo más tarde.' },
      '120',
    );
    expect(error.message).toBe(
      'Demasiados intentos. Intente de nuevo más tarde.',
    );
    expect(error.esperaSegundos).toBe(120);
  });

  it('Retry-After solo se acepta en segundos', () => {
    expect(leerRetryAfter('30')).toBe(30);
    expect(leerRetryAfter(null)).toBeNull();
    expect(leerRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull();
  });

  it('error de red: el texto de F0; un error no previsto: el genérico', () => {
    expect(errorDeRed().estado).toBeNull();
    expect(errorDeRed().message).toBe(TEXTO_ERROR_RED);
    expect(mensajeDeError(new Error('x'))).toBe(TEXTO_ERROR_GENERICO);
  });
});
