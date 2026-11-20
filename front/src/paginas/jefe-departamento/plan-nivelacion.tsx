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
 * extensión 1.a). Aparece tras canalizar a la ruta académica y en la misma
 * vista se registra y se finaliza (respuesta 1 de F3; D38).
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
}: {
  idCaso: string;
  antecedentes: readonly Antecedente[];
}) {
  const idTitulo = useId();
  const [plan, setPlan] = useState<Plan | null>(null);
  return (
    <section aria-labelledby={idTitulo} className={controles['seccion']}>
      <h2 id={idTitulo}>{ROTULOS_JEFE.planNivelacion}</h2>
      {plan === null ? (
        <FormularioPlan
          idCaso={idCaso}
          antecedentes={antecedentes}
          alRegistrar={setPlan}
        />
      ) : (
        <PlanRegistrado plan={plan} alFinalizar={setPlan} />
      )}
    </section>
  );
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
  const [bloqueado, setBloqueado] = useState(false);
  const { enviando, enEspera, error, ejecutar } = useEnvio();

  const registrar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (bloqueado) {
      return;
    }
    const datos = {
      idCaso,
      idsCursos: [...idsCursos],
      tutorNombre: tutorNombre.trim(),
      tutorCodigo: tutorCodigo.trim(),
      cronograma: cronograma.trim(),
    };
    const falta = faltante(datos);
    setErrorCampos(falta);
    if (falta !== null) {
      return;
    }
    const resultado = await ejecutar(() => registrarSinReintento(datos));
    if (resultado === undefined) {
      return;
    }
    if (resultado.tipo === 'incierto') {
      setBloqueado(true);
      return;
    }
    alRegistrar(resultado.valor);
  };

  return (
    <form className={controles['formulario']} onSubmit={registrar} noValidate>
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
  plan: Plan;
  alFinalizar: (plan: Plan) => void;
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
      <MensajeInformativo mensaje={TEXTO_PLAN_REGISTRADO} />
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
