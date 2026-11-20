import { useId, useState, type FormEvent } from 'react';
import { CampoTexto } from './campo-texto';
import controles from './controles.module.css';
import {
  ROTULOS_COMUNES,
  ROTULOS_PERIODO,
  TEXTO_INDIQUE_PERIODO,
} from './etiquetas';
import { formatearFechaHora } from './formato';
import { guardarArchivo } from './guardar-archivo';
import { MensajeError, MensajeInformativo } from './mensaje-error';
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
import estilos from '../paginas/jefe-departamento/jefe-departamento.module.css';
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
 */

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
    <PlantillaJefe titulo={TITULOS_JEFE.informes}>
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
    <PlantillaPsicologo titulo={TITULOS_PSICOLOGO.informes}>
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
  const idProgramaDom = useId();
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
    <>
      <form className={controles['formulario']} onSubmit={enviar} noValidate>
        <CampoTexto
          rotulo={ROTULOS_PERIODO.periodo}
          valor={periodo}
          alCambiar={setPeriodo}
          maximo={LIMITES.periodo}
          ayuda={ROTULOS_PERIODO.ayuda}
          requerido
          error={errorPeriodo}
        />
        <div className={controles['campo']}>
          <label htmlFor={idProgramaDom}>
            {ROTULOS_INFORMES_PSICOLOGO.programa}
          </label>
          <select
            id={idProgramaDom}
            value={indicePrograma}
            onChange={(evento) => setIndicePrograma(evento.target.value)}
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
        <CampoTexto
          rotulo={ROTULOS_COMUNES.codigoCurso}
          valor={idCurso}
          alCambiar={setIdCurso}
          maximo={LIMITES.identificador}
          requerido
        />
        <button
          type="submit"
          className={controles['boton']}
          disabled={ocupado || indicePrograma === '' || idCurso.trim() === ''}
        >
          {ROTULOS_JEFE.generarInforme}
        </button>
      </form>
    </>
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
    <form className={controles['formulario']} onSubmit={enviar} noValidate>
      <CampoTexto
        rotulo={ROTULOS_PERIODO.periodo}
        valor={periodo}
        alCambiar={setPeriodo}
        maximo={LIMITES.periodo}
        ayuda={ROTULOS_PERIODO.ayuda}
        requerido
        error={errorPeriodo}
      />
      <CampoTexto
        rotulo={ROTULOS_COMUNES.codigoCurso}
        valor={idCurso}
        alCambiar={setIdCurso}
        maximo={LIMITES.identificador}
        requerido
      />
      <button
        type="submit"
        className={controles['boton']}
        disabled={ocupado || idCurso.trim() === ''}
      >
        {ROTULOS_JEFE.generarInforme}
      </button>
    </form>
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
    <section className={controles['seccion']}>
      <dl className={estilos['datos']}>
        <div>
          <dt>{ROTULOS_COMUNES.curso}</dt>
          <dd>{informe.curso.nombre}</dd>
        </div>
        <div>
          <dt>{ROTULOS_PERIODO.periodo}</dt>
          <dd>{informe.periodo}</dd>
        </div>
        <div>
          <dt>{ROTULOS_COMUNES.fecha}</dt>
          <dd>{formatearFechaHora(informe.fecha)}</dd>
        </div>
        {TOTALES.map((total) => (
          <div key={total}>
            <dt>{ROTULOS_JEFE[total]}</dt>
            <dd>
              {informe[total]}
              <p className={controles['ayuda']}>
                {informe.definiciones[total]}
              </p>
            </dd>
          </div>
        ))}
      </dl>
      <p className={estilos['texto']}>{informe.resumen}</p>
      <MensajeError mensaje={error} />
      <button
        type="button"
        className={controles['boton']}
        disabled={enviando || enEspera}
        onClick={exportar}
      >
        {ROTULOS_JEFE.exportarPdf}
      </button>
    </section>
  );
}
