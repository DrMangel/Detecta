import { randomUUID } from 'node:crypto';
import { Alerta } from './alerta';
import type { Curso } from './curso';
import { EstadoOrigen } from './estado-origen';
import type { NivelRiesgo } from './nivel-riesgo';
import { Persona, type PropiedadesPersona } from './persona';
import type { RegistroAcademico } from './registro-academico';
import { Rol } from './rol';

export interface PropiedadesDocente extends PropiedadesPersona {
  /** Cursos que dicta (asignación docente–curso configurada en el despliegue). */
  cursos: readonly Curso[];
}

/** Entidad `Docente` (subclase de `Persona`). */
export class Docente extends Persona {
  readonly #cursos: Curso[];

  constructor(propiedades: PropiedadesDocente) {
    super(propiedades);
    this.#cursos = [...propiedades.cursos];
  }

  get cursos(): readonly Curso[] {
    return [...this.#cursos];
  }

  obtenerRol(): Rol {
    return Rol.DOCENTE;
  }

  /** Indica si el docente dicta el curso (ER 3.5.3, sd_CUD03). */
  dicta(curso: Curso): boolean {
    return this.#cursos.some((propio) => propio.idCurso === curso.idCurso);
  }

  /**
   * Emite manualmente una alerta académica temprana (R01, sd_CUD03). No hay
   * generación automática de alertas (línea base §4).
   * - Solo sobre registros de cursos que dicta (ER 3.5.3).
   * - Nivel de riesgo y descripción obligatorios (CUD03, flujo alterno 6.a).
   */
  emitirAlerta(
    registro: RegistroAcademico,
    nivelRiesgo: NivelRiesgo,
    descripcion: string,
  ): Alerta {
    if (!this.dicta(registro.curso)) {
      throw new Error('El estudiante no pertenece a un curso asignado');
    }
    if (!nivelRiesgo || descripcion.trim() === '') {
      throw new Error('Complete el nivel de riesgo y la justificación');
    }
    return new Alerta({
      idOrigen: randomUUID(),
      fecha: new Date(),
      estado: EstadoOrigen.PENDIENTE,
      nivelRiesgo,
      descripcion,
      docente: this,
      registro,
    });
  }
}
