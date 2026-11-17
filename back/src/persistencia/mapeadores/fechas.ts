/**
 * Conversión de columnas `date` (sin hora). TypeORM las devuelve como texto
 * AAAA-MM-DD; el dominio usa `Date` en hora local (p. ej. `fechaNacimiento`
 * para `esMenorDeEdad`). Se convierten sin pasar por UTC para no correr el día.
 */
export function desdeTextoFecha(texto: string | Date): Date {
  if (texto instanceof Date) {
    return new Date(texto.getFullYear(), texto.getMonth(), texto.getDate());
  }
  const [anio, mes, dia] = texto.split('-').map(Number);
  if (anio === undefined || mes === undefined || dia === undefined) {
    throw new Error(`Fecha inválida: ${texto}`);
  }
  return new Date(anio, mes - 1, dia);
}

export function aTextoFecha(fecha: Date): string {
  const anio = String(fecha.getFullYear()).padStart(4, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}
