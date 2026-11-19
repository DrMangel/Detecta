import type { FormEvent, ReactNode } from 'react';
import estilos from './formulario.module.css';
import { NOMBRE_SISTEMA } from './textos';
import { useTituloPestana } from './titulo-pestana';

/* Marco común de las pantallas de acceso (F0): título y formulario. */
export function FormularioAcceso({
  titulo,
  alEnviar,
  children,
  pie,
}: {
  titulo: string;
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
      <p className={estilos['sistema']}>{NOMBRE_SISTEMA}</p>
      <h1>{titulo}</h1>
      <form className={estilos['formulario']} onSubmit={enviar} noValidate>
        {children}
      </form>
      {pie}
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
    <button type="submit" className={estilos['boton']} disabled={deshabilitado}>
      {rotulo}
    </button>
  );
}
