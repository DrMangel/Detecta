import { useState, type FormEvent } from 'react';
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
import { AYUDA_INFORMES } from '../../componentes/textos';
import { LIMITES } from '../../servicios-api/limites';
import { PlantillaJefe } from './plantilla-jefe-departamento';
import { TITULOS_JEFE } from './textos';

/*
 * Informes de riesgo del Jefe (CUD10; sd_CUD10, rama del Jefe:
 * `seleccionarFiltros(periodo, idCurso)`; el programa lo pone el backend).
 * El curso se escribe por su código (respuesta 2 de F3, como D37). La parte
 * compartida con el Psicólogo está en componentes/iu-informes.tsx (F5d).
 */
export function InformesRiesgo() {
  return (
    <PlantillaJefe titulo={TITULOS_JEFE.informes} ayuda={AYUDA_INFORMES}>
      <IUInformes filtros={(props) => <FiltrosDelInforme {...props} />} />
    </PlantillaJefe>
  );
}

function FiltrosDelInforme({ alGenerar, ocupado }: PropsFiltros) {
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
        {ROTULOS_INFORME.generarInforme}
      </button>
    </TarjetaFiltros>
  );
}
