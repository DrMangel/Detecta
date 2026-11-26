import { useId, useState, type FormEvent } from 'react';
import { CampoTexto } from '../../componentes/campo-texto';
import controles from '../../componentes/controles.module.css';
import {
  ROTULOS_COMUNES,
  ROTULOS_INFORME,
  ROTULOS_PERIODO,
  TEXTO_INDIQUE_PERIODO,
} from '../../componentes/etiquetas';
import {
  IUInformes,
  TarjetaFiltros,
  type PropsFiltros,
} from '../../componentes/iu-informes';
import estilos from '../../componentes/iu-informes.module.css';
import { MensajeInformativo } from '../../componentes/mensaje-error';
import { AYUDA_INFORMES } from '../../componentes/textos';
import { useConsulta } from '../../componentes/use-consulta';
import { LIMITES } from '../../servicios-api/limites';
import { consultarProgramas } from '../../servicios-api/programas';
import { PlantillaPsicologo } from './plantilla-psicologo';
import {
  ROTULOS_INFORMES_PSICOLOGO,
  TEXTO_SIN_PROGRAMAS,
  TITULOS_PSICOLOGO,
} from './textos';

/*
 * Informes de riesgo del Psicólogo (CUD10): la misma IU y resultado de F3,
 * con selección de programa (F4c). La parte compartida con el Jefe está en
 * componentes/iu-informes.tsx (F5d).
 */

type Programas = Awaited<ReturnType<typeof consultarProgramas>> | null;

export function InformesRiesgoPsicologo() {
  const { datos: programas, error: errorProgramas } = useConsulta(
    consultarProgramas,
    'programas',
  );

  return (
    <PlantillaPsicologo
      titulo={TITULOS_PSICOLOGO.informes}
      ayuda={AYUDA_INFORMES}
    >
      <IUInformes
        errorConsulta={errorProgramas}
        filtros={(props) => (
          <FiltrosInformePsicologo programas={programas} {...props} />
        )}
      />
    </PlantillaPsicologo>
  );
}

function FiltrosInformePsicologo({
  programas,
  ocupado,
  alGenerar,
}: PropsFiltros & { programas: Programas }) {
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
    <TarjetaFiltros alEnviar={enviar}>
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
        {ROTULOS_INFORME.generarInforme}
      </button>
    </TarjetaFiltros>
  );
}

/** «Programa» del Psicólogo (F4c), con la misma estructura de campo. */
function SelectorPrograma({
  programas,
  valor,
  alCambiar,
  ocupado,
}: {
  programas: Programas;
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
