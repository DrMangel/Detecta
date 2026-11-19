import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { vi } from 'vitest';
import { Aplicacion } from '../aplicacion';
import type { DatosSesion, Rol } from '../servicios-api/tipos';

/*
 * Soporte de las pruebas del front (F0): API simulada sobre `fetch` y la
 * aplicación dentro de un MemoryRouter, con la ruta actual visible.
 */

export interface RespuestaSimulada {
  estado: number;
  cuerpo?: unknown;
  cabeceras?: Record<string, string>;
}

/**
 * 'red' simula un fallo de conexión (fetch rechaza). Una función puede
 * devolver una promesa para retener la respuesta (F1: envío en curso).
 */
type Simulacion =
  | RespuestaSimulada
  | 'red'
  | ((
      cuerpo: unknown,
    ) => RespuestaSimulada | 'red' | Promise<RespuestaSimulada | 'red'>);

export interface LlamadaRegistrada {
  metodo: string;
  url: string;
  cuerpo: unknown;
  credenciales: RequestCredentials | undefined;
}

/**
 * Sustituye fetch. Las claves son «MÉTODO /ruta» sin el prefijo /api. Una
 * ruta sin simular responde 404.
 */
export function simularApi(rutas: Record<string, Simulacion>) {
  const llamadas: LlamadaRegistrada[] = [];
  const falso = vi.fn(async (url: string, opciones: RequestInit = {}) => {
    const metodo = opciones.method ?? 'GET';
    const cuerpo =
      typeof opciones.body === 'string'
        ? (JSON.parse(opciones.body) as unknown)
        : undefined;
    llamadas.push({ metodo, url, cuerpo, credenciales: opciones.credentials });
    const ruta = url.replace(/^\/api/, '');
    const simulada = rutas[`${metodo} ${ruta}`];
    const resultado =
      typeof simulada === 'function' ? await simulada(cuerpo) : simulada;
    if (resultado === 'red') {
      throw new TypeError('Failed to fetch');
    }
    const { estado, cuerpo: datos, cabeceras } = resultado ?? { estado: 404 };
    return new Response(
      datos === undefined || estado === 204 ? null : JSON.stringify(datos),
      {
        status: estado,
        headers: { 'Content-Type': 'application/json', ...cabeceras },
      },
    );
  });
  vi.stubGlobal('fetch', falso);
  return { llamadas, falso };
}

export function sesionDe(rol: Rol): DatosSesion {
  return {
    id: `ID-${rol}`,
    nombre: `Usuario ${rol}`,
    correo: `${rol.toLowerCase()}@ejemplo.edu.co`,
    rol,
  };
}

export const SIN_SESION: RespuestaSimulada = {
  estado: 401,
  cuerpo: { statusCode: 401, message: 'Sesión no válida o caducada' },
};

function RutaActual() {
  const ubicacion = useLocation();
  return <div data-testid="ruta">{ubicacion.pathname}</div>;
}

export function renderizar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Aplicacion />
      <RutaActual />
    </MemoryRouter>,
  );
}
