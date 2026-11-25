import type { NivelRiesgo } from '../servicios-api/estudiante';
import { NOMBRE_NIVEL_RIESGO } from './etiquetas';
import { Icono, type NombreIcono } from './icono';
import estilos from './insignias.module.css';

/*
 * Insignias de la especificación de diseño (§4). El significado nunca
 * depende solo del color (regla 8): el riesgo lleva ícono y texto, y el
 * estado, siempre su texto.
 */

const ICONO_RIESGO: Readonly<Record<NivelRiesgo, NombreIcono>> = {
  BAJO: 'check',
  MEDIO: 'triangle-alert',
  ALTO: 'octagon-alert',
};

const CLASE_RIESGO: Readonly<Record<NivelRiesgo, string>> = {
  BAJO: 'riesgo-bajo',
  MEDIO: 'riesgo-medio',
  ALTO: 'riesgo-alto',
};

/** «Bajo», «Medio» o «Alto» (NOMBRE_NIVEL_RIESGO) con su ícono. */
export function InsigniaRiesgo({ nivel }: { nivel: NivelRiesgo }) {
  return (
    <span className={`${estilos['insignia']} ${estilos[CLASE_RIESGO[nivel]]}`}>
      <Icono nombre={ICONO_RIESGO[nivel]} tamano={14} />
      {NOMBRE_NIVEL_RIESGO[nivel]}
    </span>
  );
}

/** Tonos de estado (§4): neutro, azul (en curso) y verde (atendido). */
export type TonoEstado = 'neutro' | 'azul' | 'verde';

export function InsigniaEstado({
  texto,
  tono,
  icono,
}: {
  texto: string;
  tono: TonoEstado;
  /** Ícono decorativo opcional (por ejemplo, lock en «Confidencial», §7.0). */
  icono?: NombreIcono;
}) {
  return (
    <span className={`${estilos['insignia']} ${estilos[`estado-${tono}`]}`}>
      {icono !== undefined && <Icono nombre={icono} tamano={14} />}
      {texto}
    </span>
  );
}
