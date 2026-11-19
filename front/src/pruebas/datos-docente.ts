/* Datos de las pruebas del Docente (F2). */

/** Un id que nunca debe aparecer en el DOM (ajuste C de F2). */
export const ID_ESTUDIANTE_SECRETO = 'est-7f3a9c1e-uuid-no-visible';

export const CURSO = {
  curso: {
    idCurso: 'IS-101',
    nombre: 'Ingeniería de Software I',
    periodo: '2026-2',
    ultimaSincronizacion: '2026-11-19T08:00:00.000Z',
  },
  registros: [
    {
      idRegistro: 'R1',
      estudiante: { id: ID_ESTUDIANTE_SECRETO, nombre: 'Ana Pérez' },
      nota: 1.87,
      porcentajeAsistencia: 53,
    },
    {
      idRegistro: 'R2',
      estudiante: { id: 'est-otro', nombre: 'Luis Gómez' },
      nota: 4.2,
      porcentajeAsistencia: 100,
    },
  ],
};
