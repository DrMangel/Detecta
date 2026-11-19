import { useEffect, useRef, useState } from 'react';
import { mensajeDeError } from '../servicios-api/errores';

/*
 * Consulta al montar una pantalla (F1b; la repetían «Mis solicitudes» y el
 * listado del curso). Devuelve los datos o el texto uniforme del error; un
 * 401 ya lo atiende ProveedorSesion, que lleva al inicio de sesión.
 *
 * `clave` decide cuándo consultar de nuevo. La respuesta de una consulta
 * abandonada (otra clave, o el doble montaje de StrictMode en desarrollo,
 * línea base §4.2) se descarta.
 */

export interface Consulta<T> {
  datos: T | null;
  error: string | null;
}

export function useConsulta<T>(
  consultar: () => Promise<T>,
  clave: string,
): Consulta<T> {
  const [estado, setEstado] = useState<Consulta<T>>({
    datos: null,
    error: null,
  });
  // La función cambia en cada render; solo la clave dispara la consulta.
  const consultarActual = useRef(consultar);
  consultarActual.current = consultar;

  useEffect(() => {
    let vigente = true;
    consultarActual.current().then(
      (datos) => {
        if (vigente) setEstado({ datos, error: null });
      },
      (fallo: unknown) => {
        if (vigente) setEstado({ datos: null, error: mensajeDeError(fallo) });
      },
    );
    return () => {
      vigente = false;
    };
  }, [clave]);

  return estado;
}
