/* Datos de las pruebas del Jefe de Departamento (F3). */

/** Ids que nunca deben aparecer en el DOM (como el ajuste C de F2). */
export const ID_CASO_SECRETO = 'caso-5d1e-uuid-no-visible';
export const ID_ESTUDIANTE_SECRETO = 'est-9b2c-uuid-no-visible';

export const CASO_ALERTA = {
  idCaso: ID_CASO_SECRETO,
  fechaCreacion: '2026-11-18T15:00:00.000Z',
  estado: 'PENDIENTE',
  ruta: null,
  nivelRiesgo: 'ALTO',
  estudiante: { id: ID_ESTUDIANTE_SECRETO, nombre: 'Laura Gómez' },
  origen: {
    tipo: 'ALERTA',
    idOrigen: 'alerta-1',
    fecha: '2026-11-18T15:00:00.000Z',
    curso: {
      idCurso: 'MAT-201',
      nombre: 'Cálculo Integral',
      periodo: '2026-2',
    },
    descripcion: 'Inasistencias en las últimas semanas.',
    registro: { nota: 2.1, porcentajeAsistencia: 60 },
  },
} as const;

export const CASO_SOLICITUD = {
  idCaso: 'caso-solicitud',
  fechaCreacion: '2026-11-17T15:00:00.000Z',
  estado: 'PENDIENTE',
  ruta: null,
  nivelRiesgo: null,
  estudiante: { id: 'est-otro', nombre: 'Pedro Tres' },
  origen: {
    tipo: 'SOLICITUD',
    idOrigen: 'solicitud-1',
    fecha: '2026-11-17T15:00:00.000Z',
    tipoApoyo: 'ACADEMICA',
    motivo: 'Necesito apoyo en Cálculo.',
    disponibilidad: 'Martes en la tarde',
  },
} as const;

export const ANTECEDENTES = [
  {
    idRegistro: 'reg-1',
    curso: {
      idCurso: 'MAT-201',
      nombre: 'Cálculo Integral',
      periodo: '2026-2',
    },
    nota: 2.1,
    porcentajeAsistencia: 60,
    ultimaSincronizacion: '2026-11-19T08:00:00.000Z',
  },
  {
    idRegistro: 'reg-2',
    curso: { idCurso: 'FIS-101', nombre: 'Física I', periodo: '2026-2' },
    nota: 3.4,
    porcentajeAsistencia: 90,
    ultimaSincronizacion: '2026-11-19T08:00:00.000Z',
  },
];

export const DETALLE_ALERTA = {
  caso: CASO_ALERTA,
  antecedentes: ANTECEDENTES,
  planes: [],
};

/** El mismo caso ya canalizado a la ruta académica (F5b, D38). */
export const CASO_ACADEMICO = {
  ...CASO_ALERTA,
  ruta: 'ACADEMICA',
  estado: 'EN_NIVELACION',
} as const;

export const PLAN = {
  idPlan: 'plan-1',
  idCaso: ID_CASO_SECRETO,
  fecha: '2026-11-19T15:00:00.000Z',
  estado: 'ACTIVO',
  tutorNombre: 'Marta Ruiz',
  tutorCodigo: 'T-77',
  cronograma: '',
  cursos: [
    { idCurso: 'MAT-201', nombre: 'Cálculo Integral', periodo: '2026-2' },
  ],
};

/** Plan tal como llega en `planes` del detalle: sin idCaso ni fecha. */
export const PLAN_CASO = {
  idPlan: PLAN.idPlan,
  estado: PLAN.estado,
  tutorNombre: PLAN.tutorNombre,
  tutorCodigo: PLAN.tutorCodigo,
  cronograma: PLAN.cronograma,
  cursos: PLAN.cursos,
};

export const INFORME = {
  idInforme: 'inf-1',
  fecha: '2026-11-19T15:00:00.000Z',
  periodo: '2026-2',
  idPrograma: 'prog-1',
  curso: { idCurso: 'MAT-201', nombre: 'Cálculo Integral' },
  totalAlertas: 4,
  totalCasos: 1,
  totalPlanes: 2,
  resumen: 'Resumen del periodo.',
  definiciones: {
    totalAlertas: 'Alertas: definición.',
    totalCasos: 'Casos: definición.',
    totalPlanes: 'Planes de nivelación: definición.',
  },
};
