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
import { SESION_CADUCADA } from './textos';

/*
 * Sesión del usuario en el front (F0). Los datos de la sesión viven solo en
 * memoria; en el navegador queda únicamente la marca de pestaña (decisión
 * (g)), nunca el token ni datos del usuario.
 *
 * - Pestaña sin marca (pestaña nueva, enlace principal o dirección interna):
 *   se muestra el inicio de sesión sin consultar ni cerrar la sesión de la
 *   cookie, para no afectar a las demás pestañas (decisión (g), revisada).
 * - Al iniciar sesión, la pestaña lo avisa a las demás por BroadcastChannel,
 *   sin datos. Una pestaña con sesión que recibe el aviso consulta la sesión:
 *   si la cookie ya es de otro usuario o no hay sesión (401), vuelve al inicio
 *   de sesión con el aviso de sesión caducada; si es el mismo usuario, o la
 *   consulta falla por la red o con 5xx, no hace nada. Recibir el aviso nunca
 *   lo reenvía. Sin BroadcastChannel, la pestaña vieja se corrige con el 401
 *   de su siguiente petición.
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

const CANAL_SESION = 'detecta.sesion';
const SESION_INICIADA = 'sesion-iniciada';

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

/** null si el navegador no tiene BroadcastChannel. */
function abrirCanal(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(CANAL_SESION);
}

/**
 * Tras el aviso de otra pestaña: true si la cookie ya es de otro usuario o
 * no hay sesión (401). Con la red caída o un 5xx no se puede saber: false.
 */
async function cookieDeOtroUsuario(id: string): Promise<boolean> {
  try {
    const datos = await acceso.consultarSesion();
    return datos === null || datos.id !== id;
  } catch {
    return false;
  }
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
}

const ContextoSesion = createContext<ValorSesion | null>(null);

/**
 * Aviso entre pestañas (decisión (g), revisada): un solo canal por
 * proveedor, cerrado al desmontar; el que publica no recibe su propio aviso.
 * Solo escucha mientras la pestaña tiene usuario y nunca reenvía el aviso.
 * Devuelve la función que avisa a las demás pestañas de un inicio de sesión.
 */
function useAvisoEntrePestanas(
  usuario: DatosSesion | null | undefined,
  invalidar: (mensaje: string) => void,
): () => void {
  const canal = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const abierto = abrirCanal();
    canal.current = abierto;
    return () => {
      abierto?.close();
      canal.current = null;
    };
  }, []);

  useEffect(() => {
    const abierto = canal.current;
    if (abierto === null || !usuario) return undefined;
    let vigente = true;
    abierto.onmessage = (evento: MessageEvent) => {
      if (evento.data !== SESION_INICIADA) return;
      void cookieDeOtroUsuario(usuario.id).then((otro) => {
        if (vigente && otro) invalidar(SESION_CADUCADA);
      });
    };
    return () => {
      vigente = false;
      abierto.onmessage = null;
    };
  }, [usuario, invalidar]);

  return useCallback(() => canal.current?.postMessage(SESION_INICIADA), []);
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState<DatosSesion | null | undefined>(
    undefined,
  );
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!tieneMarca()) {
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

  const invalidar = useCallback(
    (mensaje: string) => {
      escribirMarca('quitar');
      setUsuario(null);
      setAviso({ texto: mensaje, tipo: 'error' });
      void navegar('/iniciar-sesion', { replace: true });
    },
    [navegar],
  );

  useEffect(() => {
    registrarSesionInvalida(invalidar);
    return () => registrarSesionInvalida(null);
  }, [invalidar]);

  const avisarInicio = useAvisoEntrePestanas(usuario, invalidar);

  const consumirAviso = useCallback(() => {
    const pendiente = aviso;
    setAviso(null);
    return pendiente;
  }, [aviso]);

  const anunciar = useCallback((nuevo: Aviso) => setAviso(nuevo), []);

  const establecer = useCallback(
    (datos: DatosSesion) => {
      escribirMarca('poner');
      setAviso(null);
      setUsuario(datos);
      avisarInicio();
    },
    [avisarInicio],
  );

  const cerrar = useCallback(async () => {
    try {
      await acceso.cerrarSesion();
    } finally {
      escribirMarca('quitar');
      setUsuario(null);
      void navegar('/iniciar-sesion', { replace: true });
    }
  }, [navegar]);

  const valor = useMemo(
    () => ({ usuario, aviso, consumirAviso, anunciar, establecer, cerrar }),
    [usuario, aviso, consumirAviso, anunciar, establecer, cerrar],
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
