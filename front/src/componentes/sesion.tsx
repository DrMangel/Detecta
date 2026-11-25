import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import * as acceso from '../servicios-api/acceso';
import { registrarSesionInvalida } from '../servicios-api/cliente';
import type { DatosSesion } from '../servicios-api/tipos';

/*
 * Sesión del usuario en el front (F0). Los datos de la sesión viven solo en
 * memoria; en el navegador queda únicamente la marca de pestaña (decisión
 * (g)), nunca el token ni datos del usuario.
 *
 * - Pestaña sin marca (pestaña nueva, enlace principal o dirección interna):
 *   se muestra el inicio de sesión de inmediato y la sesión de la cookie se
 *   cierra en segundo plano, aunque siga vigente (decisión (g)). El envío del
 *   acceso espera a ese cierre para que no borre la sesión nueva (ajuste A).
 * - Pestaña con marca (recarga): se consulta GET /acceso/sesion una sola
 *   vez; un 401 ahí significa «sin sesión»: no muestra mensaje ni redirige
 *   por sí mismo (ajuste A de F0) y borra la marca.
 * - Un 401 en una petición protegida borra la sesión, deja el texto del
 *   backend («Sesión no válida o caducada») como aviso de un solo uso y
 *   lleva a /iniciar-sesion (ajuste A).
 * - Tras fijar la contraseña, la pantalla de activación deja la
 *   confirmación como aviso de un solo uso (cierre de F0, punto 1).
 */

/**
 * Clave de la marca de pestaña (decisión (g)): solo indica que en esta
 * pestaña se inició sesión; nunca lleva el token ni datos del usuario.
 */
export const MARCA_PESTANA = 'detecta.pestana';

/**
 * Lo que el envío del acceso espera, como máximo, al cierre inicial (ajuste A
 * de (g)). 60 s: con la API de Render dormida (cerca de un minuto), el acceso
 * tampoco responde antes, y un límite menor dejaría que un cierre tardío
 * borrara la cookie recién creada (decisión (g), ajuste 1).
 */
export const LIMITE_CIERRE_MS = 60_000;

/** sessionStorage bloqueado por el navegador: se trata como pestaña sin marca. */
function tieneMarca(): boolean {
  try {
    return sessionStorage.getItem(MARCA_PESTANA) !== null;
  } catch {
    return false;
  }
}

const ESCRIBIR_MARCA = {
  poner: () => sessionStorage.setItem(MARCA_PESTANA, '1'),
  quitar: () => sessionStorage.removeItem(MARCA_PESTANA),
};

function escribirMarca(accion: keyof typeof ESCRIBIR_MARCA): void {
  try {
    ESCRIBIR_MARCA[accion]();
  } catch {
    // Bloqueado: la pestaña queda sin marca y la recarga pedirá las credenciales.
  }
}

/** Cierre de la sesión de la cookie que no tarda más de LIMITE_CIERRE_MS ni falla. */
function cerrarConLimite(): Promise<void> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<void>((resolver) => {
    temporizador = setTimeout(resolver, LIMITE_CIERRE_MS);
  });
  const cierre = acceso.cerrarSesion().catch(() => undefined);
  return Promise.race([cierre, limite]).finally(() =>
    clearTimeout(temporizador),
  );
}

/**
 * Recarga con marca: base o red caídas se tratan como sin sesión; la
 * pantalla de inicio de sesión mostrará el error al intentarlo.
 */
async function consultarSesionInicial(): Promise<DatosSesion | null> {
  const datos = await acceso.consultarSesion().catch(() => null);
  if (datos === null) escribirMarca('quitar');
  return datos;
}

/** Aviso de un solo uso para la pantalla de inicio de sesión. */
export interface Aviso {
  texto: string;
  /** error: role="alert"; confirmacion: role="status". */
  tipo: 'error' | 'confirmacion';
}

interface ValorSesion {
  /** undefined mientras se consulta la sesión inicial. */
  usuario: DatosSesion | null | undefined;
  /** Aviso pendiente para la pantalla de inicio de sesión (un solo uso). */
  aviso: Aviso | null;
  consumirAviso: () => Aviso | null;
  anunciar: (aviso: Aviso) => void;
  establecer: (usuario: DatosSesion) => void;
  cerrar: () => Promise<void>;
  /** Resuelve cuando termina (o vence) el cierre de una pestaña sin marca. */
  esperarCierre: () => Promise<void>;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState<DatosSesion | null | undefined>(
    undefined,
  );
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const cierreInicial = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!tieneMarca()) {
      cierreInicial.current = cerrarConLimite();
      setUsuario(null);
      return undefined;
    }
    let vigente = true;
    void consultarSesionInicial().then((datos) => {
      if (vigente) setUsuario(datos);
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    registrarSesionInvalida((mensaje) => {
      escribirMarca('quitar');
      setUsuario(null);
      setAviso({ texto: mensaje, tipo: 'error' });
      void navegar('/iniciar-sesion', { replace: true });
    });
    return () => registrarSesionInvalida(null);
  }, [navegar]);

  const consumirAviso = useCallback(() => {
    const pendiente = aviso;
    setAviso(null);
    return pendiente;
  }, [aviso]);

  const anunciar = useCallback((nuevo: Aviso) => setAviso(nuevo), []);

  const establecer = useCallback((datos: DatosSesion) => {
    escribirMarca('poner');
    setAviso(null);
    setUsuario(datos);
  }, []);

  const cerrar = useCallback(async () => {
    try {
      await acceso.cerrarSesion();
    } finally {
      escribirMarca('quitar');
      setUsuario(null);
      void navegar('/iniciar-sesion', { replace: true });
    }
  }, [navegar]);

  const esperarCierre = useCallback(() => cierreInicial.current, []);

  const valor = useMemo(
    () => ({
      usuario,
      aviso,
      consumirAviso,
      anunciar,
      establecer,
      cerrar,
      esperarCierre,
    }),
    [
      usuario,
      aviso,
      consumirAviso,
      anunciar,
      establecer,
      cerrar,
      esperarCierre,
    ],
  );
  return (
    <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
  );
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (valor === null) {
    throw new Error('useSesion fuera de ProveedorSesion');
  }
  return valor;
}
