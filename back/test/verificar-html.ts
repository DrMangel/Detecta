/*
 * Verificación estructural de HTML para las pruebas de correo (B5,
 * respuesta 8 y ajuste C). No es un validador completo del estándar: evita
 * agregar una dependencia y comprueba lo que importa en estos cuerpos:
 * etiquetas conocidas y bien anidadas, atributos entre comillas dobles,
 * ningún "<" o ">" suelto en el texto y "&" solo como inicio de entidad.
 * Admite un documento completo o un fragmento.
 * Devuelve la lista de problemas (vacía si el HTML es válido).
 */
const ETIQUETAS = new Set(['html', 'head', 'meta', 'title', 'body', 'p', 'a']);
const VACIAS = new Set(['meta']);
const ETIQUETA = /^<(\/?)([a-z]+)((?:\s+[a-z-]+="[^"<>]*")*)\s*(\/?)>/;
const ENTIDAD = /^&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i;

export function problemasHtml(html: string): string[] {
  const problemas: string[] = [];
  const pila: string[] = [];
  let resto = html.replace(/^<!DOCTYPE html>\s*/i, '');
  while (resto.length > 0) {
    const caracter = resto[0];
    if (caracter === '<') {
      const etiqueta = ETIQUETA.exec(resto);
      if (etiqueta === null) {
        problemas.push(`etiqueta mal formada: ${resto.slice(0, 30)}`);
        break;
      }
      const [completa, cierre, nombre = ''] = etiqueta;
      if (!ETIQUETAS.has(nombre)) {
        problemas.push(`etiqueta no permitida: ${nombre}`);
      } else if (cierre === '/') {
        const abierta = pila.pop();
        if (abierta !== nombre) {
          problemas.push(
            `cierre de ${nombre} sin apertura (abierta: ${abierta ?? 'ninguna'})`,
          );
        }
      } else if (!VACIAS.has(nombre)) {
        pila.push(nombre);
      }
      resto = resto.slice(completa.length);
      continue;
    }
    if (caracter === '>') {
      problemas.push('">" sin escapar en el texto');
    }
    if (caracter === '&' && !ENTIDAD.test(resto)) {
      problemas.push(`"&" sin escapar: ${resto.slice(0, 20)}`);
    }
    resto = resto.slice(1);
  }
  if (pila.length > 0) {
    problemas.push(`etiquetas sin cerrar: ${pila.join(', ')}`);
  }
  return problemas;
}
