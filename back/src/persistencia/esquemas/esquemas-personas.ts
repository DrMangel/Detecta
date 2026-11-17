import { EntitySchema } from 'typeorm';

/*
 * Esquemas de persistencia de Programa, Persona (herencia de tabla única),
 * Curso y RegistroAcademico. El dominio no conoce TypeORM: los mapeadores
 * convierten estas filas en entidades de dominio (plan de B2, punto 1).
 *
 * Las propiedades usan los nombres del dominio en camelCase (idPrograma,
 * fechaNacimiento...) y se guardan en columnas snake_case en minúsculas.
 */

export interface FilaPrograma {
  idPrograma: string;
  nombre: string;
}

export const EsquemaPrograma = new EntitySchema<FilaPrograma>({
  name: 'Programa',
  tableName: 'programa',
  columns: {
    idPrograma: {
      name: 'id_programa',
      type: 'varchar',
      length: 36,
      primary: true,
    },
    nombre: { type: 'varchar', length: 150 },
  },
});

/**
 * Clases marcadoras para la herencia de tabla única de `Persona`
 * (línea base §5). TypeORM resuelve la jerarquía de tabla única siguiendo la
 * cadena de prototipos del `target`; por eso existen estas clases vacías de
 * persistencia. No son entidades de dominio.
 */
export class ModeloPersona {
  id!: string;
  nombre!: string;
  correo!: string;
  contrasenaHash!: string;
  /** Columna discriminadora: valor del enumerado `Rol`. */
  rol!: string;
}
export class ModeloEstudiante extends ModeloPersona {
  /** `date` de PostgreSQL: TypeORM la devuelve como texto AAAA-MM-DD. */
  fechaNacimiento!: string;
  /** Programa que cursa (asociación "cursa"). */
  idPrograma!: string;
}
export class ModeloDocente extends ModeloPersona {}
export class ModeloJefeDepartamento extends ModeloPersona {
  /** Programa que dirige (asociación "dirige", 1 a 1). */
  idProgramaDirigido!: string;
}
export class ModeloPsicologo extends ModeloPersona {}

export const EsquemaPersona = new EntitySchema<ModeloPersona>({
  name: 'Persona',
  target: ModeloPersona,
  tableName: 'persona',
  inheritance: {
    pattern: 'STI',
    column: { name: 'rol', type: 'varchar', length: 20 },
  },
  columns: {
    id: { type: 'varchar', length: 36, primary: true },
    nombre: { type: 'varchar', length: 150 },
    correo: { type: 'varchar', length: 100, unique: true },
    contrasenaHash: { name: 'contrasena_hash', type: 'varchar', length: 255 },
  },
});

export const EsquemaEstudiante = new EntitySchema<ModeloEstudiante>({
  name: 'Estudiante',
  target: ModeloEstudiante,
  type: 'entity-child',
  discriminatorValue: 'ESTUDIANTE',
  columns: {
    fechaNacimiento: { name: 'fecha_nacimiento', type: 'date', nullable: true },
    idPrograma: {
      name: 'id_programa',
      type: 'varchar',
      length: 36,
      nullable: true,
    },
  },
});

export const EsquemaDocente = new EntitySchema<ModeloDocente>({
  name: 'Docente',
  target: ModeloDocente,
  type: 'entity-child',
  discriminatorValue: 'DOCENTE',
  columns: {},
});

export const EsquemaJefeDepartamento = new EntitySchema<ModeloJefeDepartamento>(
  {
    name: 'JefeDepartamento',
    target: ModeloJefeDepartamento,
    type: 'entity-child',
    discriminatorValue: 'JEFE_DEPARTAMENTO',
    columns: {
      idProgramaDirigido: {
        name: 'id_programa_dirigido',
        type: 'varchar',
        length: 36,
        nullable: true,
      },
    },
  },
);

export const EsquemaPsicologo = new EntitySchema<ModeloPsicologo>({
  name: 'Psicologo',
  target: ModeloPsicologo,
  type: 'entity-child',
  discriminatorValue: 'PSICOLOGO',
  columns: {},
});

export interface FilaCurso {
  idCurso: string;
  nombre: string;
  periodo: string;
  ultimaSincronizacion: Date | null;
  /** Docente que lo dicta ("dicta", 1). Se escribe en cascada desde guardar(docente). */
  idDocente: string;
}

export const EsquemaCurso = new EntitySchema<FilaCurso>({
  name: 'Curso',
  tableName: 'curso',
  columns: {
    idCurso: { name: 'id_curso', type: 'varchar', length: 36, primary: true },
    nombre: { type: 'varchar', length: 150 },
    periodo: { type: 'varchar', length: 20 },
    ultimaSincronizacion: {
      name: 'ultima_sincronizacion',
      type: 'timestamptz',
      nullable: true,
    },
    idDocente: { name: 'id_docente', type: 'varchar', length: 36 },
  },
});

export interface FilaRegistroAcademico {
  idRegistro: string;
  /** `numeric`: TypeORM lo devuelve como texto. */
  nota: string | number;
  porcentajeAsistencia: string | number;
  idEstudiante: string;
  idCurso: string;
}

export const EsquemaRegistroAcademico = new EntitySchema<FilaRegistroAcademico>(
  {
    name: 'RegistroAcademico',
    tableName: 'registro_academico',
    columns: {
      idRegistro: {
        name: 'id_registro',
        type: 'varchar',
        length: 36,
        primary: true,
      },
      nota: { type: 'numeric', precision: 3, scale: 2 },
      porcentajeAsistencia: {
        name: 'porcentaje_asistencia',
        type: 'numeric',
        precision: 5,
        scale: 2,
      },
      idEstudiante: { name: 'id_estudiante', type: 'varchar', length: 36 },
      idCurso: { name: 'id_curso', type: 'varchar', length: 36 },
    },
  },
);
