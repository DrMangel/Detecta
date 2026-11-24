import { useId, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import controles from '../../componentes/controles.module.css';
import {
  NOMBRE_TIPO_APOYO,
  ROTULOS_COMUNES,
  ROTULOS_PERIODO,
  TEXTO_INFORMACION_NO_DISPONIBLE,
} from '../../componentes/etiquetas';
import {
  formatearAsistencia,
  formatearFecha,
  formatearNota,
} from '../../componentes/formato';
import { GrupoOpciones } from '../../componentes/grupo-opciones';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import tabla from '../../componentes/tabla.module.css';
import { useConsulta } from '../../componentes/use-consulta';
import { useEnvio } from '../../componentes/use-envio';
import {
  enviarConConciliacion,
  type PasosEnvio,
} from '../../servicios-api/conciliacion';
import { TEXTO_ERROR_RED } from '../../servicios-api/errores';
import {
  canalizarCaso,
  consultarCaso,
  type Antecedente,
  type Caso,
  type DetalleCaso,
  type PlanCaso,
  type RutaAtencion,
} from '../../servicios-api/jefe-departamento';
import { textoNivel } from './bandeja-casos';
import estilos from './jefe-departamento.module.css';
import { PlanNivelacion } from './plan-nivelacion';
import {
  esTipoBandeja,
  PlantillaJefe,
  RUTA_BANDEJA,
  type TipoBandeja,
} from './plantilla-jefe-departamento';
import {
  NOMBRE_ORIGEN,
  NOMBRE_RUTA,
  ROTULOS_CASO,
  ROTULOS_JEFE,
  TEXTO_CANALIZADO,
  TEXTO_VOLVER,
  TITULOS_JEFE,
} from './textos';

/*
 * Detalle y canalización de un caso (CUD04 pasos 3 a 5; sd_CUD04
 * `seleccionarCaso`, `seleccionarRuta` y `canalizarCaso`).
 *
 * - Muestra origen, nivel de riesgo, justificación y antecedentes académicos
 *   (nota de sd_CUD04). Motivo y disponibilidad solo si el backend los
 *   envía (D18); tras canalizar a psicología se pinta el caso de la
 *   respuesta, que ya no los trae.
 * - La ruta no tiene valor por defecto y «Canalizar caso» sigue deshabilitado
 *   hasta elegirla (ajuste A); sin diálogo de confirmación.
 * - Ruta académica: el plan de nivelación aparece en la misma vista
 *   (sd_CUD04, «extend» CUD05; respuesta 1 de F3), también al volver al caso
 *   desde «En ruta académica», con los planes que trae el detalle (F5b, D38).
 */

/** Caso canalizado con los planes que se conocen de él. */
interface Canalizado {
  caso: Caso;
  planes: PlanCaso[];
}

const RUTAS: readonly RutaAtencion[] = ['ACADEMICA', 'PSICOLOGICA'];

/*
 * Bandeja de origen del detalle, para el enlace de regreso y el resalte del
 * menú (F5b; Manual 3.1.2.2.6, Tabla 30). Manda la que envió la bandeja en
 * el estado de navegación (la recarga lo conserva). Sin ella, o con un valor
 * no permitido, decide la ruta del caso tal como se cargó; mientras carga o
 * si la carga falla, «Casos pendientes». Canalizar no cambia el origen.
 */
const BANDEJA_POR_RUTA: Readonly<Record<RutaAtencion, TipoBandeja>> = {
  ACADEMICA: 'rutaAcademica',
  PSICOLOGICA: 'pendientes',
};

function origenDelDetalle(
  estado: unknown,
  ruta: RutaAtencion | null,
): TipoBandeja {
  const enviado =
    typeof estado === 'object' && estado !== null && 'origen' in estado
      ? estado.origen
      : null;
  if (esTipoBandeja(enviado)) return enviado;
  return ruta === null ? 'pendientes' : BANDEJA_POR_RUTA[ruta];
}

export function PaginaDetalleCaso() {
  const { idCaso = '' } = useParams();
  // Otro caso, otro detalle: estado nuevo.
  return <DetalleDelCaso key={idCaso} idCaso={idCaso} />;
}

function DetalleDelCaso({ idCaso }: { idCaso: string }) {
  const { datos, error } = useConsulta(() => consultarCaso(idCaso), idCaso);
  const origen = origenDelDetalle(
    useLocation().state,
    datos?.caso.ruta ?? null,
  );
  return (
    <PlantillaJefe titulo={TITULOS_JEFE.detalleCaso} origen={origen}>
      <Link to={RUTA_BANDEJA[origen]} className={estilos['volver']}>
        {TEXTO_VOLVER[origen]}
      </Link>
      <MensajeError mensaje={error} />
      <div aria-busy={datos === null && error === null}>
        {datos !== null && <ContenidoCaso detalle={datos} />}
      </div>
    </PlantillaJefe>
  );
}

function ContenidoCaso({ detalle }: { detalle: DetalleCaso }) {
  const [caso, setCaso] = useState(detalle.caso);
  const [planes, setPlanes] = useState(detalle.planes);
  const [canalizado, setCanalizado] = useState(false);

  const alCanalizar = (nuevo: Canalizado) => {
    setCaso(nuevo.caso);
    setPlanes(nuevo.planes);
    setCanalizado(true);
  };

  return (
    <>
      <DatosCaso caso={caso} />
      <Antecedentes antecedentes={detalle.antecedentes} />
      {caso.ruta === null ? (
        <Canalizacion idCaso={caso.idCaso} alCanalizar={alCanalizar} />
      ) : (
        <MensajeInformativo
          mensaje={
            canalizado ? TEXTO_CANALIZADO[caso.ruta] : NOMBRE_RUTA[caso.ruta]
          }
        />
      )}
      {caso.ruta === 'ACADEMICA' && (
        <PlanNivelacion
          idCaso={caso.idCaso}
          antecedentes={detalle.antecedentes}
          planes={planes}
        />
      )}
    </>
  );
}

type Fila = readonly [rotulo: string, valor: string];

/** Datos propios del origen: la alerta del docente o la solicitud. */
function filasOrigen(origen: Caso['origen']): Fila[] {
  if (origen.tipo === 'ALERTA') {
    return [
      [ROTULOS_COMUNES.curso, origen.curso.nombre],
      [ROTULOS_PERIODO.periodo, origen.curso.periodo],
      [ROTULOS_COMUNES.justificacion, origen.descripcion],
      [ROTULOS_COMUNES.nota, formatearNota(origen.registro.nota)],
      [
        ROTULOS_COMUNES.asistencia,
        formatearAsistencia(origen.registro.porcentajeAsistencia),
      ],
    ];
  }
  const filas: Fila[] = [
    [ROTULOS_COMUNES.tipoApoyo, NOMBRE_TIPO_APOYO[origen.tipoApoyo]],
  ];
  // D18: solo lo que el backend permite ver.
  if (origen.motivo !== undefined) {
    filas.push([ROTULOS_COMUNES.motivo, origen.motivo]);
  }
  if (origen.disponibilidad !== undefined && origen.disponibilidad !== '') {
    filas.push([ROTULOS_COMUNES.disponibilidad, origen.disponibilidad]);
  }
  return filas;
}

function DatosCaso({ caso }: { caso: Caso }) {
  const filas: Fila[] = [
    [ROTULOS_COMUNES.estudiante, caso.estudiante.nombre],
    [ROTULOS_COMUNES.fecha, formatearFecha(caso.fechaCreacion)],
    [ROTULOS_CASO.origen, NOMBRE_ORIGEN[caso.origen.tipo]],
    [ROTULOS_COMUNES.nivelRiesgo, textoNivel(caso.nivelRiesgo)],
    ...filasOrigen(caso.origen),
  ];
  return (
    <dl className={estilos['datos']}>
      {filas.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Antecedentes({
  antecedentes,
}: {
  antecedentes: readonly Antecedente[];
}) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo} className={controles['seccion']}>
      <h2 id={idTitulo}>{ROTULOS_CASO.antecedentes}</h2>
      {antecedentes.length === 0 ? (
        <p>{TEXTO_INFORMACION_NO_DISPONIBLE}</p>
      ) : (
        <table className={tabla['tabla']}>
          <thead>
            <tr>
              <th scope="col">{ROTULOS_COMUNES.curso}</th>
              <th scope="col">{ROTULOS_PERIODO.periodo}</th>
              <th scope="col">{ROTULOS_COMUNES.nota}</th>
              <th scope="col">{ROTULOS_COMUNES.asistencia}</th>
            </tr>
          </thead>
          <tbody>
            {antecedentes.map((registro) => (
              <tr key={registro.idRegistro}>
                <th scope="row">{registro.curso.nombre}</th>
                <td data-rotulo={ROTULOS_PERIODO.periodo}>
                  {registro.curso.periodo}
                </td>
                <td
                  className={tabla['numero']}
                  data-rotulo={ROTULOS_COMUNES.nota}
                >
                  {formatearNota(registro.nota)}
                </td>
                <td
                  className={tabla['numero']}
                  data-rotulo={ROTULOS_COMUNES.asistencia}
                >
                  {formatearAsistencia(registro.porcentajeAsistencia)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Canalización con conciliación tras un error de red: solo se ofrece a un
 * caso sin ruta, así que no hace falta consultar antes; después, el caso
 * releído dice si quedó en la ruta elegida. Reintentar es seguro: el
 * backend responde «El caso ya fue canalizado» (sd_CUD04 5.a).
 * Un caso recién canalizado no tiene planes (POST /planes exige la ruta
 * académica); el releído trae los suyos (F5b, D38).
 */
function pasosCanalizacion(
  idCaso: string,
  ruta: RutaAtencion,
): PasosEnvio<Canalizado> {
  return {
    consultarPrevias: async () => new Set<string>(),
    enviar: async () => ({
      caso: await canalizarCaso(idCaso, ruta),
      planes: [],
    }),
    buscar: async () => {
      const { caso, planes } = await consultarCaso(idCaso);
      return caso.ruta === ruta ? { caso, planes } : null;
    },
  };
}

function Canalizacion({
  idCaso,
  alCanalizar,
}: {
  idCaso: string;
  alCanalizar: (canalizado: Canalizado) => void;
}) {
  const [ruta, setRuta] = useState<RutaAtencion | null>(null);
  const { enviando, enEspera, error, ponerError, ejecutar } = useEnvio();

  const canalizar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (ruta === null) {
      return;
    }
    const resultado = await ejecutar(() =>
      enviarConConciliacion(pasosCanalizacion(idCaso, ruta)),
    );
    if (resultado === undefined) {
      return;
    }
    if (resultado.tipo === 'incierto') {
      ponerError(TEXTO_ERROR_RED);
      return;
    }
    alCanalizar(resultado.valor);
  };

  return (
    <form
      className={`${controles['formulario']} ${controles['seccion']}`}
      onSubmit={canalizar}
      noValidate
    >
      <GrupoOpciones
        leyenda={ROTULOS_JEFE.canalizarCaso}
        opciones={RUTAS}
        etiquetas={NOMBRE_RUTA}
        valor={ruta}
        alCambiar={setRuta}
        clase={estilos['grupo']}
      />
      <MensajeError mensaje={error} />
      <button
        type="submit"
        className={controles['boton']}
        disabled={ruta === null || enviando || enEspera}
      >
        {ROTULOS_JEFE.canalizarCaso}
      </button>
    </form>
  );
}
