import { useState } from 'react';
import { Link } from 'react-router';
import { Campo } from '../../componentes/campo';
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
import { useEnvio } from '../../componentes/use-envio';
import { solicitarActivacion } from '../../servicios-api/acceso';

/*
 * Solicitud del enlace de acceso (D6): activa la cuenta y también recupera
 * la contraseña (respuesta 2 del plan de F0: sin pantalla aparte). El 202
 * trae el mismo mensaje exista o no el correo; se muestra tal cual.
 */
export function PaginaSolicitarActivacion() {
  const [correo, setCorreo] = useState('');
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const enviar = async () => {
    setConfirmacion(null);
    const respuesta = await ejecutar(() => solicitarActivacion(correo.trim()));
    if (respuesta !== undefined) {
      setConfirmacion(respuesta.mensaje);
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
