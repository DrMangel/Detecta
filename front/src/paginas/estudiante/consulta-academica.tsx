import { useState } from 'react';
import { Link } from 'react-router';
import { CifraGrande } from '../../componentes/cifra-grande';
import controles from '../../componentes/controles.module.css';
import {
  NOMBRE_NIVEL_RIESGO,
  TEXTO_INFORMACION_NO_DISPONIBLE,
} from '../../componentes/etiquetas';
import { FormularioPeriodo } from '../../componentes/formulario-periodo';
import {
  formatearAsistencia,
  formatearFecha,
  formatearNota,
} from '../../componentes/formato';
import { Icono } from '../../componentes/icono';
import { ICONO_RIESGO } from '../../componentes/insignias';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import { useEnvio } from '../../componentes/use-envio';
import {
  consultarAlertas,
  consultarRegistros,
  type AlertaEstudiante,
  type NivelRiesgo,
  type RegistroEstudiante,
  type RegistrosEstudiante,
} from '../../servicios-api/estudiante';
import estilos from './estudiante.module.css';
import { PlantillaEstudiante, RUTAS_ESTUDIANTE } from './plantilla-estudiante';
import {
  AYUDA_ESTUDIANTE,
  ROTULOS_ESTUDIANTE,
  TEXTO_INDICA_PERIODO,
  TEXTO_SIN_ALERTAS,
  tituloAsignaturas,
  tituloAvisoRiesgo,
  TITULOS_ESTUDIANTE,
} from './textos';

/*
 * Consulta académica del Estudiante (CUD01; sd_CUD01, rama del estudiante).
 * El estudiante escribe el periodo (FormularioPeriodo) y ve sus notas, su asistencia y la fecha de la
 * última sincronización de cada curso, más las alertas emitidas sobre él en
 * el periodo (2.a). Sin registros, el backend responde «Información no
 * disponible» (4.a); el front no asume ningún valor (ER 3.3.1).
 *
 * Los datos viven solo en el estado del componente (nada en el navegador).
 */

/*
 * Diseño de F5b (D4b; especificación §7.2): filtro en tarjeta, una tarjeta
 * por asignatura con la nota y la asistencia como cifras grandes (la
 * asistencia con su barra) y un aviso por alerta con el color, el ícono y el
 * título de su nivel. Un dato que falte se marca «Información no disponible»,
 * sin cifra ni barra.
 */

const TARJETA = `${controles['tarjeta']} ${controles['tarjeta-estudiante']}`;

/** Clase del aviso de cada nivel (pares de color de riesgo, §2.1). */
const CLASE_AVISO: Readonly<Record<NivelRiesgo, string>> = {
  BAJO: 'riesgo-bajo',
  MEDIO: 'riesgo-medio',
  ALTO: 'riesgo-alto',
};

/** El enlace a la solicitud solo en riesgo medio y alto (decisión 1 de D4b). */
const CON_ENLACE: Readonly<Record<NivelRiesgo, boolean>> = {
  BAJO: false,
  MEDIO: true,
  ALTO: true,
};

interface Resultado {
  periodo: string;
  registros: RegistrosEstudiante;
  alertas: AlertaEstudiante[];
}

export function ConsultaAcademica() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const consultar = async (periodo: string) => {
    const datos = await ejecutar(() =>
      Promise.all([consultarRegistros(periodo), consultarAlertas(periodo)]),
    );
    // Si falla, el error queda a la vista y no se muestra el resultado anterior.
    setResultado(
      datos === undefined
        ? null
        : { periodo, registros: datos[0], alertas: datos[1] },
    );
  };

  return (
    <PlantillaEstudiante
      titulo={TITULOS_ESTUDIANTE.consulta}
      ayuda={AYUDA_ESTUDIANTE.consulta}
    >
      <div className={TARJETA}>
        <FormularioPeriodo
          alConsultar={(periodo) => void consultar(periodo)}
          ocupado={enviando || enEspera}
          claseCampo={estilos['campo']}
          textoVacio={TEXTO_INDICA_PERIODO}
          enLinea
        />
      </div>

      <MensajeError mensaje={error} />
      <div aria-busy={enviando}>
        {resultado !== null && <ResultadoConsulta resultado={resultado} />}
      </div>
    </PlantillaEstudiante>
  );
}

function ResultadoConsulta({ resultado }: { resultado: Resultado }) {
  const { registros } = resultado.registros;
  const { alertas } = resultado;
  return (
    <>
      <section className={controles['seccion']}>
        <h2>{tituloAsignaturas(resultado.periodo)}</h2>
        {registros.length === 0 ? (
          <MensajeInformativo
            mensaje={
              resultado.registros.mensaje ?? TEXTO_INFORMACION_NO_DISPONIBLE
            }
            tipo="informativo"
          />
        ) : (
          <ul className={estilos['lista']}>
            {registros.map((registro) => (
              <TarjetaAsignatura
                key={registro.idRegistro}
                registro={registro}
              />
            ))}
          </ul>
        )}
      </section>

      <section className={controles['seccion']}>
        <h2>{ROTULOS_ESTUDIANTE.alertas}</h2>
        {alertas.length === 0 ? (
          <p>{TEXTO_SIN_ALERTAS}</p>
        ) : (
          <ul className={estilos['avisos']}>
            {alertas.map((alerta) => (
              <AvisoRiesgo key={alerta.idAlerta} alerta={alerta} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function TarjetaAsignatura({ registro }: { registro: RegistroEstudiante }) {
  const { nota, porcentajeAsistencia, ultimaSincronizacion } = registro;
  return (
    <li className={`${TARJETA} ${estilos['asignatura']}`}>
      <div className={estilos['cabecera']}>
        <span className={estilos['nombre']}>{registro.curso.nombre}</span>
        <span className={estilos['sincronizacion']}>
          {`${ROTULOS_ESTUDIANTE.ultimaSincronizacion}: `}
          <span>
            {ultimaSincronizacion === null
              ? TEXTO_INFORMACION_NO_DISPONIBLE
              : formatearFecha(ultimaSincronizacion)}
          </span>
        </span>
      </div>
      <div className={estilos['cifras']}>
        <Cifra
          valor={nota}
          formatear={formatearNota}
          rotulo={ROTULOS_ESTUDIANTE.notaAcumulada}
        />
        <div className={estilos['asistencia']}>
          <Cifra
            valor={porcentajeAsistencia}
            formatear={formatearAsistencia}
            rotulo={ROTULOS_ESTUDIANTE.asistencia}
          />
          <BarraAsistencia porcentaje={porcentajeAsistencia} />
        </div>
      </div>
    </li>
  );
}

/** Cifra grande, o «Información no disponible» si falta el dato (ER 3.3.1). */
function Cifra({
  valor,
  formatear,
  rotulo,
}: {
  valor: number | null;
  formatear: (valor: number) => string;
  rotulo: string;
}) {
  if (valor === null || !Number.isFinite(valor)) {
    return (
      <div className={estilos['sin-dato']}>
        <span>{TEXTO_INFORMACION_NO_DISPONIBLE}</span>
        <span>{rotulo}</span>
      </div>
    );
  }
  return <CifraGrande valor={formatear(valor)} rotulo={rotulo} />;
}

/**
 * Barra de la asistencia (§7.2): decorativa, porque la cifra ya da el valor.
 * Se limita a 0–100 y no se dibuja sin dato.
 */
function BarraAsistencia({ porcentaje }: { porcentaje: number | null }) {
  if (porcentaje === null || !Number.isFinite(porcentaje)) {
    return null;
  }
  const ancho = Math.min(100, Math.max(0, porcentaje));
  return (
    <div className={estilos['barra']} aria-hidden="true">
      <span style={{ width: `${ancho}%` }} />
    </div>
  );
}

/** Aviso de una alerta (§7.2): nivel con ícono y título, fecha y descripción. */
function AvisoRiesgo({ alerta }: { alerta: AlertaEstudiante }) {
  const { nivelRiesgo } = alerta;
  return (
    <li
      className={`${estilos['aviso-riesgo']} ${estilos[CLASE_AVISO[nivelRiesgo]]}`}
    >
      <Icono nombre={ICONO_RIESGO[nivelRiesgo]} />
      <div className={estilos['aviso-texto']}>
        <p className={estilos['aviso-titulo']}>
          {tituloAvisoRiesgo(NOMBRE_NIVEL_RIESGO[nivelRiesgo], alerta.curso)}
        </p>
        <p className={estilos['aviso-fecha']}>{formatearFecha(alerta.fecha)}</p>
        <p>{alerta.descripcion}</p>
        {CON_ENLACE[nivelRiesgo] && (
          <Link to={RUTAS_ESTUDIANTE.nuevaSolicitud}>
            {TITULOS_ESTUDIANTE.nuevaSolicitud}
          </Link>
        )}
      </div>
    </li>
  );
}
