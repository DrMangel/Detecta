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
    const error = errorDeRespuesta({
      estado,
      cuerpo: { message: texto },
      retryAfter: null,
    });
    expect(error.estado).toBe(estado);
    expect(error.message).toBe(texto);
  });

  it('403: siempre el texto de F0, nunca el «Forbidden» del backend', () => {
    const error = errorDeRespuesta({
      estado: 403,
      cuerpo: { statusCode: 403, message: 'Forbidden' },
      retryAfter: null,
    });
    expect(error.message).toBe(TEXTO_SIN_PERMISO);
  });

  it('403 con textos permitidos por la ruta (F1, ajuste E): solo esos textos pasan', () => {
    const permitidos = [
      'No se encontró una matrícula activa asociada a su cuenta.',
    ];
    expect(
      errorDeRespuesta({
        estado: 403,
        cuerpo: { message: permitidos[0] },
        retryAfter: null,
        textos403: permitidos,
      }).message,
    ).toBe(permitidos[0]);
    expect(
      errorDeRespuesta({
        estado: 403,
        cuerpo: { statusCode: 403, message: 'Forbidden' },
        retryAfter: null,
        textos403: permitidos,
      }).message,
    ).toBe(TEXTO_SIN_PERMISO);
    expect(
      errorDeRespuesta({
        estado: 403,
        cuerpo: { message: 'Otro texto' },
        retryAfter: null,
        textos403: permitidos,
      }).message,
    ).toBe(TEXTO_SIN_PERMISO);
    // Sin lista (las demás rutas), ni siquiera ese texto pasa.
    expect(
      errorDeRespuesta({
        estado: 403,
        cuerpo: { message: permitidos[0] },
        retryAfter: null,
      }).message,
    ).toBe(TEXTO_SIN_PERMISO);
  });

  it('500: siempre el genérico, nunca el «Internal server error» de NestJS', () => {
    expect(
      errorDeRespuesta({
        estado: 500,
        cuerpo: { statusCode: 500, message: 'Internal server error' },
        retryAfter: null,
      }).message,
    ).toBe(TEXTO_ERROR_GENERICO);
  });

  it('503 sin texto, o un código no previsto: el genérico', () => {
    expect(
      errorDeRespuesta({ estado: 503, cuerpo: null, retryAfter: null }).message,
    ).toBe(TEXTO_ERROR_GENERICO);
    expect(
      errorDeRespuesta({
        estado: 502,
        cuerpo: { message: 'Bad Gateway' },
        retryAfter: null,
      }).message,
    ).toBe(TEXTO_ERROR_GENERICO);
  });

  it('429: el texto del backend y la espera de Retry-After en segundos', () => {
    const error = errorDeRespuesta({
      estado: 429,
      cuerpo: { message: 'Demasiados intentos. Intente de nuevo más tarde.' },
      retryAfter: '120',
    });
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
