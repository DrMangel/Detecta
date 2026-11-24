import { useId, useState, type FormEvent } from 'react';
import { CampoTexto } from '../../componentes/campo-texto';
import controles from '../../componentes/controles.module.css';
import {
  ROTULOS_COMUNES,
  TEXTO_INFORMACION_NO_DISPONIBLE,
} from '../../componentes/etiquetas';
import {
  MensajeError,
  MensajeInformativo,
} from '../../componentes/mensaje-error';
import { useEnvio } from '../../componentes/use-envio';
import type { ResultadoEnvio } from '../../servicios-api/conciliacion';
import { ErrorApi } from '../../servicios-api/errores';
import {
  finalizarPlan,
  registrarPlan,
  type Antecedente,
  type DatosPlan,
  type Plan,
  type PlanCaso,
} from '../../servicios-api/jefe-departamento';
import { LIMITES } from '../../servicios-api/limites';
import estilos from './jefe-departamento.module.css';
import {
  NOMBRE_ESTADO_PLAN,
  ROTULOS_JEFE,
  TEXTO_FALTA_TUTOR,
  TEXTO_PLAN_INCIERTO,
  TEXTO_PLAN_REGISTRADO,
  TEXTO_SIN_CURSOS,
} from './textos';

/*
 * Plan de nivelación académica (CUD05; sd_CUD04, «extend» CUD05 y su
 * extensión 1.a). Aparece en el detalle de un caso en ruta académica, recién
 * canalizado o reabierto desde «En ruta académica» (F5b, cierra D38):
 *
 * - Los planes del caso (D29 admite varios) se listan; cada plan activo con
 *   «Finalizar plan» y los finalizados en solo lectura.
 * - El formulario solo aparece si ningún plan conocido está activo, así no
 *   se duplica un plan activo (D29). Los finalizados quedan encima.
 * - «Plan de nivelación registrado» solo justo después de registrar, no al
 *   reabrir el caso (decisión de Ivan en F5b).
 *
 * - Cursos: los del estudiante con registro académico (antecedentes del
 *   detalle); el backend rechaza cualquier otro.
 * - Faltan el nombre o el código del tutor → texto de CUD05 5.a, sin enviar.
 * - Error de red sin respuesta: no hay forma de saber si el plan quedó y un
 *   segundo envío lo duplicaría (D29), así que el registro queda bloqueado
 *   mientras el Jefe siga en la vista (decisión de Ivan en F3). Un 400, 409 o
 *   503 no guardó nada: se muestra su texto y lo escrito se conserva.
 */

/** Cursos sin repetir de los registros del estudiante. */
function cursosDelEstudiante(
  antecedentes: readonly Antecedente[],
): Antecedente['curso'][] {
  const porId = new Map(
    antecedentes.map((registro) => [registro.curso.idCurso, registro.curso]),
  );
  return [...porId.values()];
}

/** Solo un fallo sin respuesta del servidor deja el resultado incierto. */
async function registrarSinReintento(
  datos: DatosPlan,
): Promise<ResultadoEnvio<Plan>> {
  try {
    return { tipo: 'registrado', valor: await registrarPlan(datos) };
  } catch (fallo) {
    if (fallo instanceof ErrorApi && fallo.estado === null) {
      return { tipo: 'incierto' };
    }
    throw fallo;
  }
}

function faltante(datos: DatosPlan): string | null {
  if (datos.tutorNombre.trim() === '' || datos.tutorCodigo.trim() === '') {
    return TEXTO_FALTA_TUTOR;
  }
  return datos.idsCursos.length === 0 ? TEXTO_SIN_CURSOS : null;
}

export function PlanNivelacion({
  idCaso,
  antecedentes,
  planes,
}: {
  idCaso: string;
  antecedentes: readonly Antecedente[];
  planes: readonly PlanCaso[];
}) {
  const idTitulo = useId();
  const [lista, setLista] = useState(planes);
  const [registrado, setRegistrado] = useState(false);

  const alRegistrar = (plan: Plan) => {
    setLista((previos) => [...previos, plan]);
    setRegistrado(true);
  };
  const alFinalizar = (plan: PlanCaso) =>
    setLista((previos) =>
      previos.map((previo) => (previo.idPlan === plan.idPlan ? plan : previo)),
    );

  return (
    <section aria-labelledby={idTitulo} className={controles['seccion']}>
      <h2 id={idTitulo}>{ROTULOS_JEFE.planNivelacion}</h2>
      <MensajeInformativo mensaje={registrado ? TEXTO_PLAN_REGISTRADO : null} />
      {lista.map((plan) => (
        <PlanRegistrado
          key={plan.idPlan}
          plan={plan}
          alFinalizar={alFinalizar}
        />
      ))}
      {!lista.some((plan) => plan.estado === 'ACTIVO') && (
        <FormularioPlan
          idCaso={idCaso}
          antecedentes={antecedentes}
          alRegistrar={alRegistrar}
        />
      )}
    </section>
  );
}

/**
 * Envío del plan: un solo envío a la vez (useEnvio) y, tras un resultado
 * incierto, registro bloqueado mientras el Jefe siga en la vista.
 */
function useRegistroPlan(alRegistrar: (plan: Plan) => void) {
  const [bloqueado, setBloqueado] = useState(false);
  const envio = useEnvio();

  const registrar = async (datos: DatosPlan) => {
    if (bloqueado) {
      return;
    }
    const resultado = await envio.ejecutar(() => registrarSinReintento(datos));
    if (resultado === undefined) {
      return;
    }
    if (resultado.tipo === 'incierto') {
      setBloqueado(true);
      return;
    }
    alRegistrar(resultado.valor);
  };

  return { ...envio, bloqueado, registrar };
}

function FormularioPlan({
  idCaso,
  antecedentes,
  alRegistrar,
}: {
  idCaso: string;
  antecedentes: readonly Antecedente[];
  alRegistrar: (plan: Plan) => void;
}) {
  const [tutorNombre, setTutorNombre] = useState('');
  const [tutorCodigo, setTutorCodigo] = useState('');
  const [cronograma, setCronograma] = useState('');
  const [idsCursos, setIdsCursos] = useState<readonly string[]>([]);
  const [errorCampos, setErrorCampos] = useState<string | null>(null);
  const { enviando, enEspera, error, bloqueado, registrar } =
    useRegistroPlan(alRegistrar);

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const datos = {
      idCaso,
      idsCursos: [...idsCursos],
      tutorNombre: tutorNombre.trim(),
      tutorCodigo: tutorCodigo.trim(),
      cronograma: cronograma.trim(),
    };
    const falta = faltante(datos);
    setErrorCampos(falta);
    if (falta === null) {
      void registrar(datos);
    }
  };

  return (
    <form className={controles['formulario']} onSubmit={enviar} noValidate>
      <CampoTexto
        rotulo={ROTULOS_JEFE.tutorNombre}
        valor={tutorNombre}
        alCambiar={setTutorNombre}
        maximo={LIMITES.tutorNombre}
        requerido
      />
      <CampoTexto
        rotulo={ROTULOS_JEFE.tutorCodigo}
        valor={tutorCodigo}
        alCambiar={setTutorCodigo}
        maximo={LIMITES.tutorCodigo}
        requerido
      />
      <CursosDelPlan
        cursos={cursosDelEstudiante(antecedentes)}
        elegidos={idsCursos}
        alCambiar={setIdsCursos}
      />
      <CampoTexto
        rotulo={ROTULOS_JEFE.cronograma}
        valor={cronograma}
        alCambiar={setCronograma}
        maximo={LIMITES.cronograma}
        multilinea
        contador
        clase={estilos['campo']}
      />
      <MensajeError mensaje={errorCampos} />
      <MensajeError mensaje={bloqueado ? TEXTO_PLAN_INCIERTO : error} />
      <button
        type="submit"
        className={controles['boton']}
        disabled={bloqueado || enviando || enEspera}
      >
        {ROTULOS_JEFE.registrarPlan}
      </button>
    </form>
  );
}

function CursosDelPlan({
  cursos,
  elegidos,
  alCambiar,
}: {
  cursos: readonly Antecedente['curso'][];
  elegidos: readonly string[];
  alCambiar: (ids: readonly string[]) => void;
}) {
  const alternar = (idCurso: string) =>
    alCambiar(
      elegidos.includes(idCurso)
        ? elegidos.filter((id) => id !== idCurso)
        : [...elegidos, idCurso],
    );
  return (
    <fieldset className={estilos['grupo']}>
      <legend>{ROTULOS_JEFE.cursosPlan}</legend>
      {cursos.length === 0 && <p>{TEXTO_INFORMACION_NO_DISPONIBLE}</p>}
      {cursos.map((curso) => (
        <label key={curso.idCurso} className={controles['opcion']}>
          <input
            type="checkbox"
            checked={elegidos.includes(curso.idCurso)}
            onChange={() => alternar(curso.idCurso)}
          />
          {`${curso.nombre} (${curso.periodo})`}
        </label>
      ))}
    </fieldset>
  );
}

function PlanRegistrado({
  plan,
  alFinalizar,
}: {
  plan: PlanCaso;
  alFinalizar: (plan: PlanCaso) => void;
}) {
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const finalizar = async () => {
    const finalizado = await ejecutar(() => finalizarPlan(plan.idPlan));
    if (finalizado !== undefined) {
      alFinalizar(finalizado);
    }
  };

  return (
    <>
      <dl className={estilos['datos']}>
        <div>
          <dt>{ROTULOS_COMUNES.estado}</dt>
          <dd>{NOMBRE_ESTADO_PLAN[plan.estado]}</dd>
        </div>
        <div>
          <dt>{ROTULOS_JEFE.tutorNombre}</dt>
          <dd>{plan.tutorNombre}</dd>
        </div>
        <div>
          <dt>{ROTULOS_JEFE.tutorCodigo}</dt>
          <dd>{plan.tutorCodigo}</dd>
        </div>
        <div>
          <dt>{ROTULOS_JEFE.cursosPlan}</dt>
          <dd>{plan.cursos.map((curso) => curso.nombre).join(', ')}</dd>
        </div>
      </dl>
      <MensajeError mensaje={error} />
      {plan.estado === 'ACTIVO' && (
        <button
          type="button"
          className={controles['boton']}
          disabled={enviando || enEspera}
          onClick={() => void finalizar()}
        >
          {ROTULOS_JEFE.finalizarPlan}
        </button>
      )}
    </>
  );
}
