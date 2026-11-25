import { primerNombre } from './formato';
import { InsigniaEstado } from './insignias';
import { NavegacionRol, type EnlaceRol } from './navegacion-rol';
import estilos from './pagina-inicio.module.css';
import { Plantilla } from './plantilla';
import { useSesion } from './sesion';
import { TarjetaFuncion } from './tarjeta-funcion';
import {
  saludo,
  TEXTO_AYUDA_INICIO,
  TEXTO_CONFIDENCIAL,
  TITULO_INICIO,
} from './textos';

/*
 * Pantalla de inicio de cada rol (especificación de diseño §7.0; ER 3.7 h):
 * saludo y una tarjeta-enlace por cada función del menú del rol, sin datos
 * ni cifras. Las tarjetas se derivan de los enlaces que ya declara el rol,
 * para no duplicar la lista; cada función aporta su descripción.
 */

export interface TarjetaInicio {
  descripcion: string;
  /** Insignia «Confidencial» y borde destacado (§7.0, Estudiante). */
  confidencial?: boolean;
}

export function PaginaInicio({
  enlaces,
  tarjetas,
  estudiante = false,
}: {
  enlaces: readonly EnlaceRol[];
  /** Descripción de cada función, por la ruta de su enlace. */
  tarjetas: Readonly<Record<string, TarjetaInicio>>;
  /** Radio de tarjeta del Estudiante (§2.2). */
  estudiante?: boolean;
}) {
  const { usuario } = useSesion();
  const funciones = enlaces.filter((enlace) => enlace.ruta in tarjetas);
  return (
    <Plantilla
      titulo={saludo(primerNombre(usuario?.nombre ?? ''))}
      tituloPestana={TITULO_INICIO}
      ayuda={TEXTO_AYUDA_INICIO}
      navegacion={<NavegacionRol enlaces={enlaces} />}
    >
      <div
        className={
          estudiante
            ? `${estilos['cuadricula']} ${estilos['estudiante']}`
            : estilos['cuadricula']
        }
      >
        {funciones.map((enlace) => (
          <Tarjeta
            key={enlace.ruta}
            enlace={enlace}
            {...tarjetas[enlace.ruta]!}
          />
        ))}
      </div>
    </Plantilla>
  );
}

function Tarjeta({
  enlace,
  descripcion,
  confidencial = false,
}: TarjetaInicio & { enlace: EnlaceRol }) {
  return (
    <TarjetaFuncion
      ruta={enlace.ruta}
      titulo={enlace.rotulo}
      descripcion={descripcion}
      icono={enlace.icono}
      destacada={confidencial}
      insignia={
        confidencial ? (
          <InsigniaEstado texto={TEXTO_CONFIDENCIAL} tono="azul" icono="lock" />
        ) : undefined
      }
    />
  );
}
