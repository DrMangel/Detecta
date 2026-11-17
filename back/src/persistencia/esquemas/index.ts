import {
  EsquemaCurso,
  EsquemaDocente,
  EsquemaEstudiante,
  EsquemaJefeDepartamento,
  EsquemaPersona,
  EsquemaPrograma,
  EsquemaPsicologo,
  EsquemaRegistroAcademico,
} from './esquemas-personas';
import {
  EsquemaAlerta,
  EsquemaAsesoria,
  EsquemaCasoRiesgo,
  EsquemaCita,
  EsquemaOrigenRiesgo,
  EsquemaSolicitud,
} from './esquemas-riesgo';
import {
  EsquemaInformeRiesgo,
  EsquemaInformeRiesgoCaso,
  EsquemaInformeRiesgoPlan,
  EsquemaPlanNivelacion,
  EsquemaPlanNivelacionCurso,
} from './esquemas-seguimiento';

export * from './esquemas-personas';
export * from './esquemas-riesgo';
export * from './esquemas-seguimiento';

/** Todos los esquemas que se registran en la conexión `detecta` de TypeORM. */
export const ESQUEMAS = [
  EsquemaPrograma,
  EsquemaPersona,
  EsquemaEstudiante,
  EsquemaDocente,
  EsquemaJefeDepartamento,
  EsquemaPsicologo,
  EsquemaCurso,
  EsquemaRegistroAcademico,
  EsquemaOrigenRiesgo,
  EsquemaAlerta,
  EsquemaSolicitud,
  EsquemaCasoRiesgo,
  EsquemaCita,
  EsquemaAsesoria,
  EsquemaPlanNivelacion,
  EsquemaPlanNivelacionCurso,
  EsquemaInformeRiesgo,
  EsquemaInformeRiesgoCaso,
  EsquemaInformeRiesgoPlan,
];
