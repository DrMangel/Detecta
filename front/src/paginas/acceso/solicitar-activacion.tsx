import { useState } from 'react';
import { Link } from 'react-router';
import { Campo } from '../../componentes/campo';
import { useEsperaReintento } from '../../componentes/espera-reintento';
import {
  BotonPrincipal,
  FormularioAcceso,
} from '../../componentes/formulario-acceso';
import estilos from '../../componentes/formulario.module.css';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import { ROTULOS, TITULOS } from '../../componentes/textos';
import { solicitarActivacion } from '../../servicios-api/acceso';
import { ErrorApi, mensajeDeError } from '../../servicios-api/errores';

/*
 * Solicitud del enlace de acceso (D6): activa la cuenta y también recupera
 * la contraseña (respuesta 2 del plan de F0: sin pantalla aparte). El 202
 * trae el mismo mensaje exista o no el correo; se muestra tal cual.
 */
export function PaginaSolicitarActivacion() {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { enEspera, esperar } = useEsperaReintento();

  const enviar = async () => {
    setError(null);
    setConfirmacion(null);
    setEnviando(true);
    try {
      const { mensaje } = await solicitarActivacion(correo.trim());
      setConfirmacion(mensaje);
    } catch (causa) {
      setError(mensajeDeError(causa));
      if (causa instanceof ErrorApi && causa.estado === 429) {
        esperar(causa.esperaSegundos);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <FormularioAcceso
      titulo={TITULOS.solicitarEnlace}
      alEnviar={() => void enviar()}
      pie={
        <p className={estilos['enlaces']}>
          <Link to="/iniciar-sesion">{TITULOS.iniciarSesion}</Link>
        </p>
      }
    >
      <MensajeError mensaje={error} />
      <MensajeInformativo mensaje={confirmacion} />
      <Campo
        rotulo={ROTULOS.correo}
        tipo="email"
        valor={correo}
        alCambiar={setCorreo}
        autocompletar="username"
      />
      <BotonPrincipal
        rotulo={ROTULOS.solicitarEnlace}
        deshabilitado={enviando || enEspera}
      />
    </FormularioAcceso>
  );
}
