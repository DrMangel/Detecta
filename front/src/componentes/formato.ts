/*
 * Formato de datos en pantalla (F1, respuesta 8): es-CO, coma decimal y
 * fechas dd/mm/aaaa en hora de Bogotá. Notas de 0,00 a 5,00 y asistencia de
 * 0,00 % a 100,00 %, con dos decimales (Manual, CUD01; ER 3.1, Tabla 2).
 */

const DOS_DECIMALES = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FECHA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** «3,45». */
export function formatearNota(nota: number): string {
  return DOS_DECIMALES.format(nota);
}

/** «87,50 %». */
export function formatearAsistencia(porcentaje: number): string {
  return `${DOS_DECIMALES.format(porcentaje)} %`;
}

/** «19/11/2026» en hora de Bogotá. */
export function formatearFecha(iso: string): string {
  return FECHA.format(new Date(iso));
}

/**
 * «19/11/2026 03:00»: fecha y hora de Bogotá en 24 horas (F2, respuesta 3;
 * última sincronización del curso, ER 3.3.5). Se arma por partes para no
 * depender de la coma que ICU pone entre fecha y hora.
 */
export function formatearFechaHora(iso: string): string {
  const partes = Object.fromEntries(
    FECHA_HORA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${partes['day']}/${partes['month']}/${partes['year']} ${partes['hour']}:${partes['minute']}`;
}
