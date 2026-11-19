import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Campo } from '../../componentes/campo';
import { useEsperaReintento } from '../../componentes/espera-reintento';
import {
  BotonPrincipal,
  FormularioAcceso,
} from '../../componentes/formulario-acceso';
import estilos from '../../componentes/formulario.module.css';
import { MensajeError } from '../../componentes/mensaje-error';
import { ESPACIO_POR_ROL } from '../../componentes/roles';
import { useSesion } from '../../componentes/sesion';
import { ROTULOS, TITULOS } from '../../componentes/textos';
import { iniciarSesion } from '../../servicios-api/acceso';
import { ErrorApi, mensajeDeError } from '../../servicios-api/errores';

/*
 * Inicio de sesión (ControladorAcceso.iniciarSesion; ER 1.3.1: correo y
 * contraseña propios). Muestra una vez el aviso de sesión caducada (ajuste
 * A) y respeta el 429 con Retry-After (D15).
 */
export function PaginaIniciarSesion() {
  const { consumirAviso, establecer } = useSesion();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { enEspera, esperar } = useEsperaReintento();

  // El aviso pasa a esta pantalla una sola vez (ajuste A).
  useEffect(() => {
    const aviso = consumirAviso();
    if (aviso !== null) {
      setError(aviso);
    }
    // Solo al montar: consumirAviso cambia al vaciar el aviso.
  }, []);

  const enviar = async () => {
    setError(null);
    setEnviando(true);
    try {
      const datos = await iniciarSesion(correo.trim(), contrasena);
      establecer(datos);
      void navegar(ESPACIO_POR_ROL[datos.rol], { replace: true });
    } catch (causa) {
      setError(mensajeDeError(causa));
      if (causa instanceof ErrorApi && causa.estado === 429) {
        esperar(causa.esperaSegundos);
      }
    } finally {
      setContrasena('');
      setEnviando(false);
    }
  };

  return (
    <FormularioAcceso
      titulo={TITULOS.iniciarSesion}
      alEnviar={() => void enviar()}
      pie={
        <p className={estilos['enlaces']}>
          <Link to="/solicitar-activacion">{TITULOS.solicitarEnlace}</Link>
        </p>
      }
    >
      <MensajeError mensaje={error} />
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
