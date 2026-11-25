import type { FormEvent, ReactNode } from 'react';
import logoCompleto from '../activos/logo-completo.png';
import controles from './controles.module.css';
import estilos from './formulario.module.css';
import { TEXTO_LOGO } from './textos';
import { useTituloPestana } from './titulo-pestana';

/*
 * Marco común de las pantallas de acceso (F0; especificación de diseño §7.1
 * en D4a): logo completo, y en una tarjeta el título, la ayuda opcional, el
 * formulario con el botón a lo ancho y el enlace del pie, centrado.
 */
export function FormularioAcceso({
  titulo,
  ayuda,
  alEnviar,
  children,
  pie,
}: {
  titulo: string;
  /** Ayuda bajo el título (solo «Iniciar sesión», §7.1). */
  ayuda?: string;
  alEnviar: () => void;
  children: ReactNode;
  pie?: ReactNode;
}) {
  useTituloPestana(titulo);
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    alEnviar();
  };
  return (
    <main className={estilos['marco']}>
      <img src={logoCompleto} alt={TEXTO_LOGO} className={estilos['logo']} />
      <div className={estilos['tarjeta']}>
        <div className={estilos['encabezado']}>
          <h1>{titulo}</h1>
          {ayuda !== undefined && <p className={estilos['ayuda']}>{ayuda}</p>}
        </div>
        <form className={estilos['formulario']} onSubmit={enviar} noValidate>
          {children}
        </form>
        {pie}
      </div>
    </main>
  );
}

/* Botón principal; deshabilitado mientras se envía o durante un 429. */
export function BotonPrincipal({
  rotulo,
  deshabilitado,
}: {
  rotulo: string;
  deshabilitado: boolean;
}) {
  return (
    <button
      type="submit"
      className={controles['boton']}
      disabled={deshabilitado}
    >
      {rotulo}
    </button>
  );
}
