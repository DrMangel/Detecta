import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
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
import { ESPACIO_POR_ROL } from '../../componentes/roles';
import { useSesion } from '../../componentes/sesion';
import {
  ROTULOS,
  TEXTO_AYUDA_INICIAR_SESION,
  TITULOS,
} from '../../componentes/textos';
import { useEnvio } from '../../componentes/use-envio';
import { iniciarSesion } from '../../servicios-api/acceso';

/*
 * Inicio de sesión (ControladorAcceso.iniciarSesion; ER 1.3.1: correo y
 * contraseña propios). Muestra una vez el aviso de sesión caducada (ajuste
 * A) o la confirmación de la contraseña fijada (cierre de F0), y respeta el
 * 429 con Retry-After (D15).
 */
export function PaginaIniciarSesion() {
  const { consumirAviso, establecer } = useSesion();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const { enviando, enEspera, error, ponerError, ejecutar } = useEnvio();

  // El aviso pasa a esta pantalla una sola vez (ajuste A).
  useEffect(() => {
    const aviso = consumirAviso();
    if (aviso !== null) {
      const mostrar = { error: ponerError, confirmacion: setConfirmacion };
      mostrar[aviso.tipo](aviso.texto);
    }
    // Solo al montar: consumirAviso cambia al vaciar el aviso.
  }, []);

  const enviar = async () => {
    setConfirmacion(null);
    await ejecutar(async () => {
      const datos = await iniciarSesion(correo.trim(), contrasena);
      establecer(datos);
      void navegar(ESPACIO_POR_ROL[datos.rol], { replace: true });
    });
    // La contraseña no queda en el formulario, haya funcionado o no.
    setContrasena('');
  };

  return (
    <FormularioAcceso
      titulo={TITULOS.iniciarSesion}
      ayuda={TEXTO_AYUDA_INICIAR_SESION}
      alEnviar={() => void enviar()}
      pie={
        <p className={estilos['enlaces']}>
          <Link to="/solicitar-activacion">{TITULOS.solicitarEnlace}</Link>
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
      <Campo
        rotulo={ROTULOS.contrasena}
        tipo="password"
        valor={contrasena}
        alCambiar={setContrasena}
        autocompletar="current-password"
      />
      <BotonPrincipal
        rotulo={ROTULOS.iniciarSesion}
        deshabilitado={enviando || enEspera}
      />
    </FormularioAcceso>
  );
}
