import { useId, useState, type FormEvent } from 'react';
import { Aviso } from './aviso';
import { CampoTexto } from './campo-texto';
import { CifraGrande } from './cifra-grande';
import controles from './controles.module.css';
import {
  ROTULOS_COMUNES,
  ROTULOS_PERIODO,
  TEXTO_INDIQUE_PERIODO,
} from './etiquetas';
import { formatearFechaHora } from './formato';
import { guardarArchivo } from './guardar-archivo';
import { Icono } from './icono';
import { MensajeError, MensajeInformativo } from './mensaje-error';
import { ParesDatos } from './pares-datos';
import { AVISO_INFORME_AGREGADO, AYUDA_INFORMES } from './textos';
import { useEnvio } from './use-envio';
import { useConsulta } from './use-consulta';
import {
  exportarInforme,
  generarInforme,
  type FiltrosInforme,
  type Informe,
  type ResultadoInforme,
} from '../servicios-api/informes';
import { consultarProgramas } from '../servicios-api/programas';
import { LIMITES } from '../servicios-api/limites';
import estilos from './iu-informes.module.css';
import { PlantillaJefe } from '../paginas/jefe-departamento/plantilla-jefe-departamento';
import { PlantillaPsicologo } from '../paginas/psicologo/plantilla-psicologo';
import {
  ROTULOS_INFORMES_PSICOLOGO,
  TEXTO_SIN_PROGRAMAS,
  TITULOS_PSICOLOGO,
} from '../paginas/psicologo/textos';
import {
  ROTULOS_JEFE,
  TEXTO_GENERANDO_INFORME,
  TITULOS_JEFE,
} from '../paginas/jefe-departamento/textos';

/*
 * Informes de riesgo por asignatura (CUD10; sd_CUD10, rama del Jefe:
 * `seleccionarFiltros(periodo, idCurso)`; el programa lo pone el backend).
 *
 * - El curso se escribe por su código (respuesta 2 de F3, como D37).
 * - 200 sin informe: el mensaje del backend («No hay datos para el periodo
 *   seleccionado», sd_CUD10 3.a). 201: los totales con sus definiciones,
 *   solo datos agregados (R07).
 * - Estado de carga mientras se genera y botón deshabilitado (ajuste E;
 *   ER: menos de 5 s).
 * - Exportar (paso 6): el PDF se descarga con un nombre derivado del periodo
 *   y el curso (ajuste C) y no se guarda en el navegador.
 *
 * Diseño de F5b (D7b; §7.7, maquetas 12 y 13): ayuda, filtros en tarjeta
 * con la misma estructura por campo (etiqueta, control y línea de ayuda de
 * altura fija), informe en tarjeta con tres cifras grandes y su definición,
 * aviso con lock y «Exportar PDF» secundario. Estilos propios en
 * iu-informes.module.css (ya no los del módulo del Jefe).
 */

/** Tarjeta de los filtros y formulario con los campos en fila. */
const CLASE_FILTROS = `${controles['formulario']} ${estilos['filtros']}`;

const TOTALES = ['totalAlertas', 'totalCasos', 'totalPlanes'] as const;

function nombreArchivo(informe: Informe): string {
  const base = `informe-riesgo-${informe.periodo}-${informe.curso.idCurso}`;
  return `${base.replace(/[^\w-]+/g, '-')}.pdf`;
}

export function InformesRiesgo() {
  const [resultado, setResultado] = useState<ResultadoInforme | null>(null);
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const generar = async (filtros: FiltrosInforme) => {
    setResultado(null);
    setResultado((await ejecutar(() => generarInforme(filtros))) ?? null);
  };

  return (
    <PlantillaJefe titulo={TITULOS_JEFE.informes} ayuda={AYUDA_INFORMES}>
      <FiltrosDelInforme
        alGenerar={(filtros) => void generar(filtros)}
        ocupado={enviando || enEspera}
      />
      {enviando && <p role="status">{TEXTO_GENERANDO_INFORME}</p>}
      <MensajeError mensaje={error} />
      <div aria-busy={enviando}>
        {resultado !== null &&
          ('mensaje' in resultado ? (
            <MensajeInformativo mensaje={resultado.mensaje} />
          ) : (
            <InformeGenerado informe={resultado.informe} />
          ))}
      </div>
    </PlantillaJefe>
  );
}

/** Misma IU y resultado de F3, con selección de programa para CUD10 (F4c). */
export function InformesRiesgoPsicologo() {
  const { datos: programas, error: errorProgramas } = useConsulta(
    consultarProgramas,
    'programas',
  );
  const [resultado, setResultado] = useState<ResultadoInforme | null>(null);
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const generar = async (filtros: FiltrosInforme) => {
    setResultado(null);
    setResultado((await ejecutar(() => generarInforme(filtros))) ?? null);
  };

  return (
    <PlantillaPsicologo
      titulo={TITULOS_PSICOLOGO.informes}
      ayuda={AYUDA_INFORMES}
    >
      <FiltrosInformePsicologo
        programas={programas}
        ocupado={enviando || enEspera}
        alGenerar={(filtros) => void generar(filtros)}
      />
      {enviando && <p role="status">{TEXTO_GENERANDO_INFORME}</p>}
      <MensajeError mensaje={errorProgramas ?? error} />
      <div aria-busy={enviando}>
        {resultado !== null &&
          ('mensaje' in resultado ? (
            <MensajeInformativo mensaje={resultado.mensaje} />
          ) : (
            <InformeGenerado informe={resultado.informe} />
          ))}
      </div>
    </PlantillaPsicologo>
  );
}

function FiltrosInformePsicologo({
  programas,
  ocupado,
  alGenerar,
}: {
  programas: Awaited<ReturnType<typeof consultarProgramas>> | null;
  ocupado: boolean;
  alGenerar: (filtros: FiltrosInforme) => void;
}) {
  const [periodo, setPeriodo] = useState('');
  const [idCurso, setIdCurso] = useState('');
  const [indicePrograma, setIndicePrograma] = useState('');
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (periodo.trim() === '') {
      setErrorPeriodo(TEXTO_INDIQUE_PERIODO);
      return;
    }
    const programa =
      indicePrograma === '' ? undefined : programas?.[Number(indicePrograma)];
    if (programa === undefined || idCurso.trim() === '') {
      return;
    }
    setErrorPeriodo(null);
    alGenerar({
      periodo: periodo.trim(),
      idPrograma: programa.idPrograma,
      idCurso: idCurso.trim(),
    });
  };

  return (
    <div className={`${controles['tarjeta']} ${estilos['tarjeta-filtros']}`}>
      <form className={CLASE_FILTROS} onSubmit={enviar} noValidate>
        <CampoTexto
          rotulo={ROTULOS_PERIODO.periodo}
          valor={periodo}
          alCambiar={setPeriodo}
          maximo={LIMITES.periodo}
          ayuda={ROTULOS_PERIODO.ayuda}
          requerido
          error={errorPeriodo}
          clase={estilos['campo-filtro']}
        />
        <SelectorPrograma
          programas={programas}
          valor={indicePrograma}
          alCambiar={setIndicePrograma}
          ocupado={ocupado}
        />
        <CampoTexto
          rotulo={ROTULOS_COMUNES.codigoCurso}
          valor={idCurso}
          alCambiar={setIdCurso}
          maximo={LIMITES.identificador}
          requerido
          clase={estilos['campo-filtro']}
        />
        <button
          type="submit"
          className={controles['boton']}
          disabled={ocupado || indicePrograma === '' || idCurso.trim() === ''}
        >
          {ROTULOS_JEFE.generarInforme}
        </button>
      </form>
    </div>
  );
}

/** «Programa» del Psicólogo (F4c), con la misma estructura de campo. */
function SelectorPrograma({
  programas,
  valor,
  alCambiar,
  ocupado,
}: {
  programas: Awaited<ReturnType<typeof consultarProgramas>> | null;
  valor: string;
  alCambiar: (valor: string) => void;
  ocupado: boolean;
}) {
  const idProgramaDom = useId();
  return (
    <div
      className={`${controles['campo']} ${estilos['campo-filtro']} ${estilos['programa']}`}
    >
      <label htmlFor={idProgramaDom}>
        {ROTULOS_INFORMES_PSICOLOGO.programa}
      </label>
      <select
        id={idProgramaDom}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        disabled={programas === null || programas.length === 0 || ocupado}
        required
      >
        <option value="">
          {ROTULOS_INFORMES_PSICOLOGO.seleccionarPrograma}
        </option>
        {(programas ?? []).map((programa, indice) => (
          <option key={indice} value={String(indice)}>
            {programa.nombre}
          </option>
        ))}
      </select>
      {programas?.length === 0 && (
        <MensajeInformativo mensaje={TEXTO_SIN_PROGRAMAS} />
      )}
    </div>
  );
}

function FiltrosDelInforme({
  alGenerar,
  ocupado,
}: {
  alGenerar: (filtros: FiltrosInforme) => void;
  ocupado: boolean;
}) {
  const [periodo, setPeriodo] = useState('');
  const [idCurso, setIdCurso] = useState('');
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (periodo.trim() === '') {
      setErrorPeriodo(TEXTO_INDIQUE_PERIODO);
      return;
    }
    setErrorPeriodo(null);
    alGenerar({ periodo: periodo.trim(), idCurso: idCurso.trim() });
  };

  return (
    <div className={`${controles['tarjeta']} ${estilos['tarjeta-filtros']}`}>
      <form className={CLASE_FILTROS} onSubmit={enviar} noValidate>
        <CampoTexto
          rotulo={ROTULOS_PERIODO.periodo}
          valor={periodo}
          alCambiar={setPeriodo}
          maximo={LIMITES.periodo}
          ayuda={ROTULOS_PERIODO.ayuda}
          requerido
          error={errorPeriodo}
          clase={estilos['campo-filtro']}
        />
        <CampoTexto
          rotulo={ROTULOS_COMUNES.codigoCurso}
          valor={idCurso}
          alCambiar={setIdCurso}
          maximo={LIMITES.identificador}
          requerido
          clase={estilos['campo-filtro']}
        />
        <button
          type="submit"
          className={controles['boton']}
          disabled={ocupado || idCurso.trim() === ''}
        >
          {ROTULOS_JEFE.generarInforme}
        </button>
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
            rotulo={ROTULOS_JEFE[total]}
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
        {ROTULOS_JEFE.exportarPdf}
      </button>
    </section>
  );
}
