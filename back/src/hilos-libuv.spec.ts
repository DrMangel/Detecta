import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hilosLibuvValido, resolverHilosLibuv } from './hilos-libuv';

describe('hilos de libuv (B9, ajuste 3a)', () => {
  const env = (contenido: string) => () => contenido;

  it('toma UV_THREADPOOL_SIZE de .env cuando el entorno externo no la trae', () => {
    expect(
      resolverHilosLibuv({}, env('JWT_SECRETO=x\nUV_THREADPOOL_SIZE=8\n')),
    ).toBe('8');
  });

  it('si el entorno externo ya la trae, no fija nada (manda la externa)', () => {
    expect(
      resolverHilosLibuv(
        { UV_THREADPOOL_SIZE: '2' },
        env('UV_THREADPOOL_SIZE=8'),
      ),
    ).toBeNull();
  });

  it('una variable externa vacía se fija en 4 (libuv usaría 1 hilo)', () => {
    expect(
      resolverHilosLibuv(
        { UV_THREADPOOL_SIZE: ' ' },
        env('UV_THREADPOOL_SIZE=8'),
      ),
    ).toBe('4');
  });

  it('sin .env, sin la clave o con un valor inválido no fija nada', () => {
    expect(resolverHilosLibuv({}, () => null)).toBeNull();
    expect(resolverHilosLibuv({}, env('PUERTO=3000'))).toBeNull();
    expect(resolverHilosLibuv({}, env('UV_THREADPOOL_SIZE=0'))).toBeNull();
    expect(resolverHilosLibuv({}, env('UV_THREADPOOL_SIZE=200'))).toBeNull();
    expect(resolverHilosLibuv({}, env('UV_THREADPOOL_SIZE=abc'))).toBeNull();
  });

  it('el rango admitido es de 1 a 128', () => {
    expect(hilosLibuvValido('1')).toBe(true);
    expect(hilosLibuvValido('128')).toBe(true);
    expect(hilosLibuvValido('0')).toBe(false);
    expect(hilosLibuvValido('129')).toBe(false);
    expect(hilosLibuvValido(' ')).toBe(false);
  });

  it('es la primera importación de main.ts (libuv lee la variable una sola vez)', () => {
    const fuente = readFileSync(join(__dirname, 'main.ts'), 'utf8');
    const primera =
      /^import\s+['"][^'"]+['"]|^import\s.+?from\s+['"][^'"]+['"]/m.exec(
        fuente,
      )?.[0];

    expect(primera).toBe("import './hilos-libuv'");
  });
});
