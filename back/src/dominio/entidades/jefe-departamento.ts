import { randomUUID } from 'node:crypto';
import type { CasoRiesgo } from './caso-riesgo';
import type { Curso } from './curso';
import { EstadoPlan } from './estado-plan';
import { Persona, type PropiedadesPersona } from './persona';
import { PlanNivelacion } from './plan-nivelacion';
import type { Programa } from './programa';
import { Rol } from './rol';
import { RutaAtencion } from './ruta-atencion';

export interface PropiedadesJefeDepartamento extends PropiedadesPersona {
  /** Programa que dirige (asociación "dirige", 1 a 1, línea base §4). */
  programa: Programa;
}

/** Entidad `JefeDepartamento` (subclase de `Persona`). */
export class JefeDepartamento extends Persona {
  readonly #programa: Programa;

  constructor(propiedades: PropiedadesJefeDepartamento) {
    super(propiedades);
    this.#programa = propiedades.programa;
  }

  get programa(): Programa {
    return this.#programa;
  }

  obtenerRol(): Rol {
    return Rol.JEFE_DEPARTAMENTO;
  }

  /**
   * Estructura el plan de nivelación de un caso con ruta ACADEMICA (R04,
   * CUD05 dentro de sd_CUD04). El plan nace ACTIVO.
   * - Nombre y código del tutor obligatorios (CUD05, flujo alterno 5.a); son
   *   datos informativos que el sistema no valida (nota del diagrama).
   * - Al menos un curso (asociación "refuerza", multiplicidad 1..*).
   * - `descripcion` queda vacía: no llega como parámetro (decisión abierta D10).
   */
  estructurarPlanNivelacion(
    caso: CasoRiesgo,
    cursos: readonly Curso[],
    tutorNombre: string,
    tutorCodigo: string,
    cronograma: string,
  ): PlanNivelacion {
    if (caso.ruta !== RutaAtencion.ACADEMICA) {
      throw new Error(
        'El plan de nivelación requiere un caso con ruta ACADEMICA',
      );
    }
    if (tutorNombre.trim() === '' || tutorCodigo.trim() === '') {
      throw new Error('Faltan los datos del estudiante tutor');
    }
    return new PlanNivelacion({
      idPlan: randomUUID(),
      descripcion: '',
      fecha: new Date(),
      cronograma,
      tutorNombre,
      tutorCodigo,
      estado: EstadoPlan.ACTIVO,
      caso,
      cursos,
    });
  }
}
