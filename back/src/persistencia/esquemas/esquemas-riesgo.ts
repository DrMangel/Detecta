import { EntitySchema } from 'typeorm';

/*
 * Esquemas de OrigenRiesgo (herencia de tabla única), CasoRiesgo, Cita y
 * Asesoria. Ver el comentario de esquemas-personas.ts.
 */

/** Clases marcadoras de la herencia de tabla única de `OrigenRiesgo`. */
export class ModeloOrigenRiesgo {
  idOrigen!: string;
  fecha!: Date;
  estado!: string;
  /** Columna discriminadora: ALERTA o SOLICITUD. */
  tipo!: string;
}
export class ModeloAlerta extends ModeloOrigenRiesgo {
  nivelRiesgo!: string;
  descripcion!: string;
  /** Docente que la emite ("emite"). */
  idDocente!: string;
  /** Registro que la sustenta ("sustentada en", 1; ER 3.5.5). */
  idRegistro!: string;
}
export class ModeloSolicitud extends ModeloOrigenRiesgo {
  tipoApoyo!: string;
  motivo!: string;
  disponibilidad!: string;
  /** Estudiante que la radica ("radica"). */
  idEstudiante!: string;
}

export const TIPO_ALERTA = 'ALERTA';
export const TIPO_SOLICITUD = 'SOLICITUD';

export const EsquemaOrigenRiesgo = new EntitySchema<ModeloOrigenRiesgo>({
  name: 'OrigenRiesgo',
  target: ModeloOrigenRiesgo,
  tableName: 'origen_riesgo',
  inheritance: {
    pattern: 'STI',
    column: { name: 'tipo', type: 'varchar', length: 20 },
  },
  columns: {
    idOrigen: { name: 'id_origen', type: 'varchar', length: 36, primary: true },
    fecha: { type: 'timestamptz' },
    estado: { type: 'varchar', length: 20 },
  },
});

export const EsquemaAlerta = new EntitySchema<ModeloAlerta>({
  name: 'Alerta',
  target: ModeloAlerta,
  type: 'entity-child',
  discriminatorValue: TIPO_ALERTA,
  columns: {
    nivelRiesgo: {
      name: 'nivel_riesgo',
      type: 'varchar',
      length: 20,
      nullable: true,
    },
    descripcion: { type: 'text', nullable: true },
    idDocente: {
      name: 'id_docente',
      type: 'varchar',
      length: 36,
      nullable: true,
    },
    idRegistro: {
      name: 'id_registro',
      type: 'varchar',
      length: 36,
      nullable: true,
    },
  },
});

export const EsquemaSolicitud = new EntitySchema<ModeloSolicitud>({
  name: 'SolicitudAcompanamiento',
  target: ModeloSolicitud,
  type: 'entity-child',
  discriminatorValue: TIPO_SOLICITUD,
  columns: {
    tipoApoyo: {
      name: 'tipo_apoyo',
      type: 'varchar',
      length: 20,
      nullable: true,
    },
    motivo: { type: 'text', nullable: true },
    disponibilidad: { type: 'text', nullable: true },
    idEstudiante: {
      name: 'id_estudiante',
      type: 'varchar',
      length: 36,
      nullable: true,
    },
  },
});

export interface FilaCasoRiesgo {
  idCaso: string;
  fechaCreacion: Date;
  motivo: string;
  nivelRiesgo: string | null;
  ruta: string | null;
  estado: string;
  justificacion: string;
  confidencialidad: boolean;
  consentimientoConfirmado: boolean;
  idEstudiante: string;
  /** Único origen del caso (D7): NOT NULL y UNIQUE. */
  idOrigen: string;
  idPsicologo: string | null;
  /** Jefe que canaliza (0..1). Derivado en el adaptador, el dominio no lo expone. */
  idJefe: string | null;
}

export const EsquemaCasoRiesgo = new EntitySchema<FilaCasoRiesgo>({
  name: 'CasoRiesgo',
  tableName: 'caso_riesgo',
  columns: {
    idCaso: { name: 'id_caso', type: 'varchar', length: 36, primary: true },
    fechaCreacion: { name: 'fecha_creacion', type: 'timestamptz' },
    motivo: { type: 'text' },
    nivelRiesgo: {
      name: 'nivel_riesgo',
      type: 'varchar',
      length: 20,
      nullable: true,
    },
    ruta: { type: 'varchar', length: 20, nullable: true },
    estado: { type: 'varchar', length: 20 },
    justificacion: { type: 'text' },
    confidencialidad: { type: 'boolean' },
    consentimientoConfirmado: {
      name: 'consentimiento_confirmado',
      type: 'boolean',
    },
    idEstudiante: { name: 'id_estudiante', type: 'varchar', length: 36 },
    idOrigen: { name: 'id_origen', type: 'varchar', length: 36, unique: true },
    idPsicologo: {
      name: 'id_psicologo',
      type: 'varchar',
      length: 36,
      nullable: true,
    },
    idJefe: { name: 'id_jefe', type: 'varchar', length: 36, nullable: true },
  },
});

export interface FilaCita {
  idCita: string;
  fechaHora: Date;
  modalidad: string;
  estado: string;
  /** Caso que la programa. Se fija al insertar en cascada desde guardar(caso). */
  idCaso: string;
  /** Psicólogo de la agenda ("agenda"). Se fija al insertar: caso.psicologo. */
  idPsicologo: string;
}

export const EsquemaCita = new EntitySchema<FilaCita>({
  name: 'Cita',
  tableName: 'cita',
  columns: {
    idCita: { name: 'id_cita', type: 'varchar', length: 36, primary: true },
    fechaHora: { name: 'fecha_hora', type: 'timestamptz' },
    modalidad: { type: 'varchar', length: 20 },
    estado: { type: 'varchar', length: 20 },
    idCaso: { name: 'id_caso', type: 'varchar', length: 36 },
    idPsicologo: { name: 'id_psicologo', type: 'varchar', length: 36 },
  },
});

export interface FilaAsesoria {
  idAsesoria: string;
  fecha: Date;
  tipoAsesoria: string;
  observaciones: string;
  acuerdos: string;
  asistencia: boolean;
  requiereSeguimiento: boolean;
  presentaRiesgoCritico: boolean;
  /** Cita que la genera (0..1 por cita): NOT NULL y UNIQUE. */
  idCita: string;
}

export const EsquemaAsesoria = new EntitySchema<FilaAsesoria>({
  name: 'Asesoria',
  tableName: 'asesoria',
  columns: {
    idAsesoria: {
      name: 'id_asesoria',
      type: 'varchar',
      length: 36,
      primary: true,
    },
    fecha: { type: 'timestamptz' },
    tipoAsesoria: { name: 'tipo_asesoria', type: 'varchar', length: 20 },
    observaciones: { type: 'text' },
    acuerdos: { type: 'text' },
    asistencia: { type: 'boolean' },
    requiereSeguimiento: { name: 'requiere_seguimiento', type: 'boolean' },
    presentaRiesgoCritico: { name: 'presenta_riesgo_critico', type: 'boolean' },
    idCita: { name: 'id_cita', type: 'varchar', length: 36, unique: true },
  },
});
