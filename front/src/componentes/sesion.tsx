import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import * as acceso from '../servicios-api/acceso';
import { registrarSesionInvalida } from '../servicios-api/cliente';
import type { DatosSesion } from '../servicios-api/tipos';

/*
 * Sesión del usuario en el front (F0). Solo en memoria: nada en
 * localStorage, sessionStorage ni cachés (plan del front, reglas de trabajo).
 *
 * - Al arrancar se consulta GET /acceso/sesion una sola vez; un 401 ahí
 *   significa «sin sesión»: no muestra mensaje ni redirige por sí mismo
 *   (ajuste A).
 * - Un 401 en una petición protegida borra la sesión, deja el texto del
 *   backend («Sesión no válida o caducada») como aviso de un solo uso y
 *   lleva a /iniciar-sesion (ajuste A).
 */

interface ValorSesion {
  /** undefined mientras se consulta la sesión inicial. */
  usuario: DatosSesion | null | undefined;
  /** Aviso pendiente para la pantalla de inicio de sesión (un solo uso). */
  aviso: string | null;
  consumirAviso: () => string | null;
  establecer: (usuario: DatosSesion) => void;
  cerrar: () => Promise<void>;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState<DatosSesion | null | undefined>(
    undefined,
  );
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    acceso.consultarSesion().then(
      (datos) => {
        if (vigente) setUsuario(datos);
      },
      () => {
        // Base o red caídas al arrancar: se trata como sin sesión; la
        // pantalla de inicio de sesión mostrará el error al intentarlo.
        if (vigente) setUsuario(null);
      },
    );
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    registrarSesionInvalida((mensaje) => {
      setUsuario(null);
      setAviso(mensaje);
      void navegar('/iniciar-sesion', { replace: true });
    });
    return () => registrarSesionInvalida(null);
  }, [navegar]);

  const consumirAviso = useCallback(() => {
    const pendiente = aviso;
    setAviso(null);
    return pendiente;
  }, [aviso]);

  const establecer = useCallback((datos: DatosSesion) => {
    setAviso(null);
    setUsuario(datos);
  }, []);

  const cerrar = useCallback(async () => {
    try {
      await acceso.cerrarSesion();
    } finally {
      setUsuario(null);
      void navegar('/iniciar-sesion', { replace: true });
    }
  }, [navegar]);

  const valor = useMemo(
    () => ({ usuario, aviso, consumirAviso, establecer, cerrar }),
    [usuario, aviso, consumirAviso, establecer, cerrar],
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
