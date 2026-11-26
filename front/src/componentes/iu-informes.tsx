import { useState, type FormEvent, type ReactNode } from 'react';
import { Aviso } from './aviso';
import { CifraGrande } from './cifra-grande';
import controles from './controles.module.css';
import {
  ROTULOS_COMUNES,
  ROTULOS_INFORME,
  ROTULOS_PERIODO,
  TEXTO_GENERANDO_INFORME,
} from './etiquetas';
import { formatearFechaHora } from './formato';
import { guardarArchivo } from './guardar-archivo';
import { Icono } from './icono';
import { MensajeError, MensajeInformativo } from './mensaje-error';
import { ParesDatos } from './pares-datos';
import { AVISO_INFORME_AGREGADO } from './textos';
import { useEnvio } from './use-envio';
import {
  exportarInforme,
  generarInforme,
  type FiltrosInforme,
  type Informe,
  type ResultadoInforme,
} from '../servicios-api/informes';
import estilos from './iu-informes.module.css';

/*
 * Parte compartida de los informes de riesgo por asignatura (CUD10;
 * sd_CUD10): la usan el Jefe de Departamento y el Psicólogo. Cada página
 * (paginas/jefe-departamento/informes-riesgo.tsx y paginas/psicologo/
 * informes.tsx) monta su plantilla, su título y su formulario de filtros;
 * así componentes no depende de paginas (diagrama de paquetes, Figura 16; F5d).
 *
 * - 200 sin informe: el mensaje del backend («No hay datos para el periodo
 *   seleccionado», sd_CUD10 3.a). 201: los totales con sus definiciones,
 *   solo datos agregados (R07).
 * - Estado de carga mientras se genera y botón deshabilitado (ajuste E;
 *   ER: menos de 5 s).
 * - Exportar (paso 6): el PDF se descarga con un nombre derivado del periodo
 *   y el curso (ajuste C) y no se guarda en el navegador.
 *
 * Diseño de F5b (D7b; §7.7, maquetas 12 y 13): filtros en tarjeta con la
 * misma estructura por campo (etiqueta, control y línea de ayuda de altura
 * fija), informe en tarjeta con tres cifras grandes y su definición, aviso
 * con lock y «Exportar PDF» secundario. Estilos en iu-informes.module.css.
 */

/** Lo que cada formulario de filtros recibe del componente compartido. */
export interface PropsFiltros {
  alGenerar: (filtros: FiltrosInforme) => void;
  ocupado: boolean;
}

/** Tarjeta de los filtros y formulario con los campos en fila. */
const CLASE_FILTROS = `${controles['formulario']} ${estilos['filtros']}`;

const TOTALES = ['totalAlertas', 'totalCasos', 'totalPlanes'] as const;

function nombreArchivo(informe: Informe): string {
  const base = `informe-riesgo-${informe.periodo}-${informe.curso.idCurso}`;
  return `${base.replace(/[^\w-]+/g, '-')}.pdf`;
}

/**
 * Filtros, estado de carga, error y resultado. `filtros` se llama como
 * función (no se monta como componente) para que el formulario conserve lo
 * escrito entre renders. `errorConsulta`: el error de la consulta previa
 * del Psicólogo (programas), mostrado en el mismo lugar que el del envío.
 */
export function IUInformes({
  filtros,
  errorConsulta = null,
}: {
  filtros: (props: PropsFiltros) => ReactNode;
  errorConsulta?: string | null;
}) {
  const [resultado, setResultado] = useState<ResultadoInforme | null>(null);
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const generar = async (valores: FiltrosInforme) => {
    setResultado(null);
    setResultado((await ejecutar(() => generarInforme(valores))) ?? null);
  };

  return (
    <>
      {filtros({
        alGenerar: (valores) => void generar(valores),
        ocupado: enviando || enEspera,
      })}
      {enviando && <p role="status">{TEXTO_GENERANDO_INFORME}</p>}
      <MensajeError mensaje={errorConsulta ?? error} />
      <div aria-busy={enviando}>
        {resultado !== null &&
          ('mensaje' in resultado ? (
            <MensajeInformativo mensaje={resultado.mensaje} />
          ) : (
            <InformeGenerado informe={resultado.informe} />
          ))}
      </div>
    </>
  );
}

/** Tarjeta y formulario comunes a los filtros del Jefe y del Psicólogo. */
export function TarjetaFiltros({
  alEnviar,
  children,
}: {
  alEnviar: (evento: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <div className={`${controles['tarjeta']} ${estilos['tarjeta-filtros']}`}>
      <form className={CLASE_FILTROS} onSubmit={alEnviar} noValidate>
        {children}
      </form>
    </div>
  );
}

function InformeGenerado({ informe }: { informe: Informe }) {
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const exportar = () =>
    void ejecutar(async () =>
      guardarArchivo(
        await exportarInforme(informe.idInforme),
        nombreArchivo(informe),
      ),
    );

  return (
    <section
      className={`${controles['seccion']} ${controles['tarjeta']} ${estilos['informe']}`}
    >
      <ParesDatos
        columnas={3}
        datos={[
          { rotulo: ROTULOS_COMUNES.curso, valor: informe.curso.nombre },
          { rotulo: ROTULOS_PERIODO.periodo, valor: informe.periodo },
          {
            rotulo: ROTULOS_COMUNES.fecha,
            valor: formatearFechaHora(informe.fecha),
          },
        ]}
      />
      <div className={estilos['cifras']}>
        {TOTALES.map((total) => (
          <CifraGrande
            key={total}
            valor={String(informe[total])}
            rotulo={ROTULOS_INFORME[total]}
            definicion={informe.definiciones[total]}
          />
        ))}
      </div>
      <p className={estilos['resumen']}>{informe.resumen}</p>
      <Aviso icono="lock">
        <p>{AVISO_INFORME_AGREGADO}</p>
      </Aviso>
      <MensajeError mensaje={error} />
      <button
        type="button"
        className={controles['boton-secundario']}
        disabled={enviando || enEspera}
        onClick={exportar}
      >
        <Icono nombre="download" tamano={18} />
        {ROTULOS_INFORME.exportarPdf}
      </button>
    </section>
  );
}
