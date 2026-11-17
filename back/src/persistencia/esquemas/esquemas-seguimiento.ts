import { EntitySchema } from 'typeorm';

/*
 * Esquemas de PlanNivelacion e InformeRiesgo con sus tablas de asociación.
 * Ver el comentario de esquemas-personas.ts.
 */

export interface FilaPlanNivelacion {
  idPlan: string;
  descripcion: string;
  fecha: Date;
  cronograma: string;
  tutorNombre: string;
  tutorCodigo: string;
  estado: string;
  /** Caso del que nace ("nace de", 1). */
  idCaso: string;
  /** Jefe que lo estructura ("estructura", 1). Derivado en el adaptador. */
  idJefe: string;
}

export const EsquemaPlanNivelacion = new EntitySchema<FilaPlanNivelacion>({
  name: 'PlanNivelacion',
  tableName: 'plan_nivelacion',
  columns: {
    idPlan: { name: 'id_plan', type: 'varchar', length: 36, primary: true },
    descripcion: { type: 'text' },
    fecha: { type: 'timestamptz' },
    cronograma: { type: 'text' },
    tutorNombre: { name: 'tutor_nombre', type: 'varchar', length: 150 },
    tutorCodigo: { name: 'tutor_codigo', type: 'varchar', length: 20 },
    estado: { type: 'varchar', length: 20 },
    idCaso: { name: 'id_caso', type: 'varchar', length: 36 },
    idJefe: { name: 'id_jefe', type: 'varchar', length: 36 },
  },
});

/** Asociación "refuerza" (PlanNivelacion 0..* — 1..* Curso). */
export interface FilaPlanNivelacionCurso {
  idPlan: string;
  idCurso: string;
}

export const EsquemaPlanNivelacionCurso =
  new EntitySchema<FilaPlanNivelacionCurso>({
    name: 'PlanNivelacionCurso',
    tableName: 'plan_nivelacion_curso',
    columns: {
      idPlan: { name: 'id_plan', type: 'varchar', length: 36, primary: true },
      idCurso: { name: 'id_curso', type: 'varchar', length: 36, primary: true },
    },
  });

/**
 * Las columnas del actor que genera el informe (Jefe o Psicólogo, asociación
 * "genera") se agregan en B8 (decisión de Ivan en el plan de B2).
 */
export interface FilaInformeRiesgo {
  idInforme: string;
  fecha: Date;
  periodo: string;
  totalAlertas: number;
  totalCasos: number;
  totalPlanes: number;
  resumen: string;
  /** Curso del que reporta ("reporta", 1). */
  idCurso: string;
}

export const EsquemaInformeRiesgo = new EntitySchema<FilaInformeRiesgo>({
  name: 'InformeRiesgo',
  tableName: 'informe_riesgo',
  columns: {
    idInforme: {
      name: 'id_informe',
      type: 'varchar',
      length: 36,
      primary: true,
    },
    fecha: { type: 'timestamptz' },
    periodo: { type: 'varchar', length: 20 },
    totalAlertas: { name: 'total_alertas', type: 'integer' },
    totalCasos: { name: 'total_casos', type: 'integer' },
    totalPlanes: { name: 'total_planes', type: 'integer' },
    resumen: { type: 'text' },
    idCurso: { name: 'id_curso', type: 'varchar', length: 36 },
  },
});

/** Asociación "resume" (InformeRiesgo — CasoRiesgo). */
export interface FilaInformeRiesgoCaso {
  idInforme: string;
  idCaso: string;
}

export const EsquemaInformeRiesgoCaso = new EntitySchema<FilaInformeRiesgoCaso>(
  {
    name: 'InformeRiesgoCaso',
    tableName: 'informe_riesgo_caso',
    columns: {
      idInforme: {
        name: 'id_informe',
        type: 'varchar',
        length: 36,
        primary: true,
      },
      idCaso: { name: 'id_caso', type: 'varchar', length: 36, primary: true },
    },
  },
);

/** Asociación "resume" (InformeRiesgo — PlanNivelacion). */
export interface FilaInformeRiesgoPlan {
  idInforme: string;
  idPlan: string;
}

export const EsquemaInformeRiesgoPlan = new EntitySchema<FilaInformeRiesgoPlan>(
  {
    name: 'InformeRiesgoPlan',
    tableName: 'informe_riesgo_plan',
    columns: {
      idInforme: {
        name: 'id_informe',
        type: 'varchar',
        length: 36,
        primary: true,
      },
      idPlan: { name: 'id_plan', type: 'varchar', length: 36, primary: true },
    },
  },
);
