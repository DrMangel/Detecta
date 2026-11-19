import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ServicioAutenticacion } from '../aplicacion/servicios/servicio-autenticacion';
import { Estudiante } from '../dominio/entidades/estudiante';
import { Programa } from '../dominio/entidades/programa';
import { ControladorAcceso } from './controlador-acceso';
import { crearLimitadores, LimitadorPeticiones } from './limitador-peticiones';
import {
  FALLOS_INICIO_POR_IP,
  FALLOS_INICIO_POR_IP_Y_CORREO,
  MENSAJE_DEMASIADOS_INTENTOS,
  SOLICITUDES_ACTIVACION_POR_CORREO,
  SOLICITUDES_ACTIVACION_POR_IP,
  VENTANA_ACTIVACION_MS,
  VENTANA_INICIO_SESION_MS,
} from './limites-peticiones';

/** Reloj controlable. */
function reloj(inicio = Date.parse('2026-11-19T15:00:00Z')) {
  let ahora = inicio;
  return {
    leer: () => new Date(ahora),
    avanzar: (ms: number) => {
      ahora += ms;
    },
  };
}

describe('LimitadorPeticiones (B9, D15, ajuste A)', () => {
  it('bloquea al alcanzar el límite y devuelve los segundos de espera; la ventana es deslizante', () => {
    const r = reloj();
    const limitador = new LimitadorPeticiones(r.leer, 60_000);
    for (let i = 0; i < 3; i++) {
      expect(limitador.bloqueo('k', 3)).toBeNull();
      limitador.registrar('k', 3);
      r.avanzar(10_000);
    }
    // Marcas en t=0, 10 s y 20 s; ahora t=30 s: la más antigua vence en 30 s.
    expect(limitador.bloqueo('k', 3)).toBe(30);
    r.avanzar(30_001);
    expect(limitador.bloqueo('k', 3)).toBeNull();
  });

  it('reiniciar libera la clave', () => {
    const r = reloj();
    const limitador = new LimitadorPeticiones(r.leer, 60_000);
    limitador.registrar('k', 1);
    expect(limitador.bloqueo('k', 1)).not.toBeNull();
    limitador.reiniciar('k');
    expect(limitador.bloqueo('k', 1)).toBeNull();
  });

  it('memoria acotada: no supera el tope de claves; primero descarta las vencidas', () => {
    const r = reloj();
    const limitador = new LimitadorPeticiones(r.leer, 60_000, 3);
    limitador.registrar('vieja', 5);
    r.avanzar(61_000);
    limitador.registrar('a', 5);
    limitador.registrar('b', 5);
    limitador.registrar('c', 5); // llena: se descarta 'vieja' (vencida)
    expect(limitador.tamano).toBe(3);
    limitador.registrar('d', 5); // sin vencidas: se descarta la más antigua ('a')
    expect(limitador.tamano).toBe(3);
    expect(limitador.bloqueo('a', 1)).toBeNull();
    expect(limitador.bloqueo('d', 1)).not.toBeNull();
  });

  it('guarda como máximo `limite` marcas por clave', () => {
    const r = reloj();
    const limitador = new LimitadorPeticiones(r.leer, 60_000);
    for (let i = 0; i < 1000; i++) {
      limitador.registrar('k', 2);
    }
    expect(limitador.bloqueo('k', 2)).toBe(60);
  });
});

describe('ControladorAcceso con los limitadores (B9, ajuste A)', () => {
  const programa = new Programa({ idPrograma: 'P1', nombre: 'Sistemas' });
  const ana = new Estudiante({
    id: 'E1',
    nombre: 'Ana',
    correo: 'ana@ejemplo.edu.co',
    contrasenaHash: 'h',
    fechaNacimiento: new Date(2000, 0, 1),
    programa,
  });

  function preparar() {
    const r = reloj();
    const servicio = {
      autenticar: jest.fn(async (correo: string, contrasena: string) => {
        if (contrasena !== 'buena') {
          throw new UnauthorizedException('Credenciales inválidas');
        }
        void correo;
        return ana;
      }),
      solicitarActivacion: jest.fn(),
    };
    const controlador = new ControladorAcceso(
      servicio as unknown as ServicioAutenticacion,
      { signAsync: jest.fn(async () => 'token') } as unknown as JwtService,
      { segura: true, duracionMin: 60 },
      crearLimitadores(r.leer),
    );
    const cabeceras: Record<string, string> = {};
    const respuesta = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      setHeader: (nombre: string, valor: string) => {
        cabeceras[nombre] = valor;
      },
    };
    return { controlador, servicio, respuesta, cabeceras, r };
  }

  async function estado(trabajo: () => unknown): Promise<number> {
    try {
      await trabajo();
      return 200;
    } catch (error) {
      return error instanceof HttpException ? error.getStatus() : -1;
    }
  }

  it(`inicio de sesión: ${FALLOS_INICIO_POR_IP_Y_CORREO} fallos del par (IP, correo) → 429 con Retry-After, incluso con la contraseña correcta`, async () => {
    const { controlador, respuesta, cabeceras } = preparar();
    for (let i = 0; i < FALLOS_INICIO_POR_IP_Y_CORREO; i++) {
      expect(
        await estado(() =>
          controlador.iniciarSesion(
            { correo: 'ANA@ejemplo.edu.co ', contrasena: 'mala' },
            '10.0.0.1',
            respuesta,
          ),
        ),
      ).toBe(401);
    }
    let error: unknown;
    try {
      await controlador.iniciarSesion(
        { correo: 'ana@ejemplo.edu.co', contrasena: 'buena' },
        '10.0.0.1',
        respuesta,
      );
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).message).toBe(MENSAJE_DEMASIADOS_INTENTOS);
    expect(Number(cabeceras['Retry-After'])).toBeGreaterThan(0);
    expect(Number(cabeceras['Retry-After'])).toBeLessThanOrEqual(
      VENTANA_INICIO_SESION_MS / 1000,
    );
    // Otra IP con el mismo correo no está bloqueada.
    expect(
      await estado(() =>
        controlador.iniciarSesion(
          { correo: 'ana@ejemplo.edu.co', contrasena: 'buena' },
          '10.0.0.2',
          respuesta,
        ),
      ),
    ).toBe(200);
  });

  it('un inicio exitoso reinicia el contador del par; los éxitos no cuentan', async () => {
    const { controlador, respuesta } = preparar();
    for (let ronda = 0; ronda < 3; ronda++) {
      for (let i = 0; i < FALLOS_INICIO_POR_IP_Y_CORREO - 1; i++) {
        await estado(() =>
          controlador.iniciarSesion(
            { correo: 'ana@ejemplo.edu.co', contrasena: 'mala' },
            '10.0.0.1',
            respuesta,
          ),
        );
      }
      expect(
        await estado(() =>
          controlador.iniciarSesion(
            { correo: 'ana@ejemplo.edu.co', contrasena: 'buena' },
            '10.0.0.1',
            respuesta,
          ),
        ),
      ).toBe(200);
    }
  });

  it(`inicio de sesión: ${FALLOS_INICIO_POR_IP} fallos por IP con distintos correos → 429 para cualquier correo; la ventana vence a los 15 min`, async () => {
    const { controlador, respuesta, r } = preparar();
    for (let i = 0; i < FALLOS_INICIO_POR_IP; i++) {
      await estado(() =>
        controlador.iniciarSesion(
          { correo: `x${i}@ejemplo.edu.co`, contrasena: 'mala' },
          '10.0.0.9',
          respuesta,
        ),
      );
    }
    expect(
      await estado(() =>
        controlador.iniciarSesion(
          { correo: 'ana@ejemplo.edu.co', contrasena: 'buena' },
          '10.0.0.9',
          respuesta,
        ),
      ),
    ).toBe(429);
    r.avanzar(VENTANA_INICIO_SESION_MS + 1);
    expect(
      await estado(() =>
        controlador.iniciarSesion(
          { correo: 'ana@ejemplo.edu.co', contrasena: 'buena' },
          '10.0.0.9',
          respuesta,
        ),
      ),
    ).toBe(200);
  });

  it(`activación: ${SOLICITUDES_ACTIVACION_POR_CORREO} por correo → 429 sin llamar al servicio, exista o no el correo`, async () => {
    const { controlador, servicio, respuesta } = preparar();
    for (const correo of ['ana@ejemplo.edu.co', 'nadie@ejemplo.edu.co']) {
      for (let i = 0; i < SOLICITUDES_ACTIVACION_POR_CORREO; i++) {
        expect(
          await estado(() =>
            controlador.solicitarActivacion({ correo }, '10.0.0.1', respuesta),
          ),
        ).toBe(200);
      }
      const llamadas = servicio.solicitarActivacion.mock.calls.length;
      expect(
        await estado(() =>
          controlador.solicitarActivacion(
            { correo: ` ${correo.toUpperCase()}` },
            '10.0.0.1',
            respuesta,
          ),
        ),
      ).toBe(429);
      expect(servicio.solicitarActivacion.mock.calls.length).toBe(llamadas);
    }
  });

  it(`activación: ${SOLICITUDES_ACTIVACION_POR_IP} por IP (todas las peticiones, incluso inválidas) → 429; la ventana vence a la hora`, async () => {
    const { controlador, respuesta, r } = preparar();
    for (let i = 0; i < SOLICITUDES_ACTIVACION_POR_IP; i++) {
      await estado(() =>
        controlador.solicitarActivacion(
          i % 2 === 0 ? { correo: `c${i}@ejemplo.edu.co` } : {},
          '10.0.0.5',
          respuesta,
        ),
      );
    }
    expect(
      await estado(() =>
        controlador.solicitarActivacion(
          { correo: 'otro@ejemplo.edu.co' },
          '10.0.0.5',
          respuesta,
        ),
      ),
    ).toBe(429);
    r.avanzar(VENTANA_ACTIVACION_MS + 1);
    expect(
      await estado(() =>
        controlador.solicitarActivacion(
          { correo: 'otro@ejemplo.edu.co' },
          '10.0.0.5',
          respuesta,
        ),
      ),
    ).toBe(200);
  });
});
