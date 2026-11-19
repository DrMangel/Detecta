import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Campo } from '../../componentes/campo';
import {
  BotonPrincipal,
  FormularioAcceso,
} from '../../componentes/formulario-acceso';
import estilos from '../../componentes/formulario.module.css';
import { MensajeError } from '../../componentes/mensaje-error';
import { ROTULOS, TITULOS } from '../../componentes/textos';
import { activarCuenta } from '../../servicios-api/acceso';
import { mensajeDeError } from '../../servicios-api/errores';

/*
 * Fijar la contraseña con el enlace de activación (D6; nota para F0 de la
 * línea base). El backend envía `/activar#token=…`: el fragmento nunca viaja
 * al servidor ni en Referer. El token se lee del fragmento, se borra de la
 * URL de inmediato con history.replaceState (ajuste C), vive solo en memoria,
 * se envía en el CUERPO del POST y se descarta tras activarse la cuenta.
 */

/** Texto del backend (B3, MENSAJE_ENLACE_INVALIDO), reutilizado. */
const TEXTO_ENLACE_INVALIDO = 'El enlace no es válido o ya caducó';

function leerTokenDelFragmento(): string | null {
  const parametros = new URLSearchParams(window.location.hash.slice(1));
  const token = parametros.get('token');
  return token !== null && token !== '' ? token : null;
}

export function PaginaActivar() {
  const navegar = useNavigate();
  // Lectura única al montar; el token no se registra ni se guarda en
  // almacenamiento del navegador.
  const token = useRef<string | null>(null);
  const [leido, setLeido] = useState(false);
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (token.current === null) {
      token.current = leerTokenDelFragmento();
    }
    if (window.location.hash !== '') {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    }
    if (token.current === null) {
      setError(TEXTO_ENLACE_INVALIDO);
    }
    setLeido(true);
  }, []);

  const enviar = async () => {
    if (token.current === null) {
      setError(TEXTO_ENLACE_INVALIDO);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await activarCuenta(token.current, contrasena);
      token.current = null;
      setContrasena('');
      void navegar('/iniciar-sesion', { replace: true });
    } catch (causa) {
      setError(mensajeDeError(causa));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <FormularioAcceso
      titulo={TITULOS.fijarContrasena}
      alEnviar={() => void enviar()}
      pie={
        <p className={estilos['enlaces']}>
          <Link to="/solicitar-activacion">{TITULOS.solicitarEnlace}</Link>
        </p>
      }
    >
      <MensajeError mensaje={error} />
      <Campo
        rotulo={ROTULOS.nuevaContrasena}
        tipo="password"
        valor={contrasena}
        alCambiar={setContrasena}
        autocompletar="new-password"
      />
      <BotonPrincipal
        rotulo={ROTULOS.fijarContrasena}
        deshabilitado={!leido || enviando || token.current === null}
      />
    </FormularioAcceso>
  );
}
