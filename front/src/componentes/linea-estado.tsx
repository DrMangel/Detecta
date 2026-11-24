import { Icono } from './icono';
import estilos from './linea-estado.module.css';
import oculto from './oculto.module.css';
import { TEXTO_ESTADO_PASO } from './textos';

/*
 * Línea de estado del caso (especificación de diseño, §4 y 7.4): pasos
 * unidos por un trazo. El texto de cada paso siempre se ve; el paso actual
 * lleva aria-current="step" y el hecho, el ícono check. Hecho y pendiente
 * se anuncian además con texto oculto, para no depender del color (regla 8).
 */

export type EstadoPaso = 'hecho' | 'actual' | 'pendiente';

export interface Paso {
  rotulo: string;
  estado: EstadoPaso;
}

export function LineaEstado({ pasos }: { pasos: readonly Paso[] }) {
  return (
    <ol className={estilos['linea']}>
      {pasos.map((paso) => (
        <li
          key={paso.rotulo}
          className={`${estilos['paso']} ${estilos[paso.estado]}`}
          aria-current={paso.estado === 'actual' ? 'step' : undefined}
        >
          <span className={estilos['marca']}>
            {paso.estado === 'hecho' && <Icono nombre="check" tamano={16} />}
          </span>
          {paso.rotulo}
          <EstadoOculto estado={paso.estado} />
        </li>
      ))}
    </ol>
  );
}

/** «, completado» o «, pendiente», solo para lectores de pantalla. */
function EstadoOculto({ estado }: { estado: EstadoPaso }) {
  if (estado === 'actual') {
    return null;
  }
  return (
    <span className={oculto['oculto']}>{`, ${TEXTO_ESTADO_PASO[estado]}`}</span>
  );
}
