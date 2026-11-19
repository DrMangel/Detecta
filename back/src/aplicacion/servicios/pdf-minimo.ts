/*
 * Generador de PDF mínimo, sin dependencias (respuesta 7 y ajuste A del plan
 * de B8): PDF 1.4 de solo texto, fuente estándar Helvetica con codificación
 * WinAnsi (tildes y ñ), páginas A4 con un límite de líneas por página, y
 * tabla xref con los desplazamientos exactos de cada objeto.
 */

/** Líneas de texto por página (A4, 11 pt, interlineado de 15 pt). */
export const LINEAS_POR_PAGINA = 48;
/** Caracteres por línea antes de partirla (Helvetica 11 pt, márgenes de 50 pt). */
export const CARACTERES_POR_LINEA = 90;

const ANCHO_PAGINA = 595;
const ALTO_PAGINA = 842;
const MARGEN_SUPERIOR = 790;

/**
 * Caracteres de WinAnsi (Windows-1252) fuera de Latin-1 en 0x80–0x9F. El
 * resto de Latin-1 coincide byte a byte.
 */
const WINANSI_EXTRA: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/**
 * Codifica una línea como cadena literal de PDF en WinAnsi: escapa la barra
 * invertida y los paréntesis; lo que WinAnsi no representa se vuelve "?".
 */
export function cadenaPdf(texto: string): Buffer {
  const bytes: number[] = [0x28]; // (
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 0x3f;
    let byte: number;
    if (caracter in WINANSI_EXTRA) {
      byte = WINANSI_EXTRA[caracter] ?? 0x3f;
    } else if (
      (codigo >= 0x20 && codigo <= 0x7e) ||
      (codigo >= 0xa0 && codigo <= 0xff)
    ) {
      byte = codigo;
    } else {
      byte = 0x3f; // ?
    }
    if (byte === 0x5c || byte === 0x28 || byte === 0x29) {
      bytes.push(0x5c); // \\ antes de \\, ( o )
    }
    bytes.push(byte);
  }
  bytes.push(0x29); // )
  return Buffer.from(bytes);
}

/** Parte las líneas largas por palabras (o por caracteres si no hay espacios). */
export function partirLineas(lineas: readonly string[]): string[] {
  const resultado: string[] = [];
  for (const linea of lineas) {
    // Por puntos de código: WinAnsi no tiene caracteres compuestos.
    let resto = Array.from(linea);
    while (resto.length > CARACTERES_POR_LINEA) {
      const tramo = resto.slice(0, CARACTERES_POR_LINEA);
      const corte = tramo.lastIndexOf(' ');
      const fin = corte > 0 ? corte : tramo.length;
      resultado.push(tramo.slice(0, fin).join(''));
      resto = resto.slice(resto[fin] === ' ' ? fin + 1 : fin);
    }
    resultado.push(resto.join(''));
  }
  return resultado;
}

/** Genera un PDF con las líneas dadas, repartidas en páginas. */
export function generarPdf(lineas: readonly string[]): Buffer {
  const todas = partirLineas(lineas);
  const paginas: string[][] = [];
  for (let i = 0; i < Math.max(todas.length, 1); i += LINEAS_POR_PAGINA) {
    paginas.push(todas.slice(i, i + LINEAS_POR_PAGINA));
  }

  // Objetos: 1 catálogo, 2 árbol de páginas, 3 fuente; luego, por página,
  // el objeto de página y su flujo de contenido.
  const objetos: Buffer[] = [];
  const idsPaginas = paginas.map((_, i) => 4 + i * 2);
  objetos.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'));
  objetos.push(
    Buffer.from(
      `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(' ')}] /Count ${paginas.length} >>`,
      'latin1',
    ),
  );
  objetos.push(
    Buffer.from(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      'latin1',
    ),
  );
  for (const [i, pagina] of paginas.entries()) {
    const partes: Buffer[] = [
      Buffer.from(`BT /F1 11 Tf 15 TL 50 ${MARGEN_SUPERIOR} Td\n`, 'latin1'),
    ];
    for (const linea of pagina) {
      partes.push(cadenaPdf(linea), Buffer.from(" '\n", 'latin1'));
    }
    partes.push(Buffer.from('ET', 'latin1'));
    const contenido = Buffer.concat(partes);
    objetos.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${(idsPaginas[i] ?? 0) + 1} 0 R >>`,
        'latin1',
      ),
    );
    objetos.push(
      Buffer.concat([
        Buffer.from(`<< /Length ${contenido.length} >>\nstream\n`, 'latin1'),
        contenido,
        Buffer.from('\nendstream', 'latin1'),
      ]),
    );
  }

  const trozos: Buffer[] = [
    // Cabecera con un comentario binario (recomendado por la especificación).
    Buffer.from([
      ...Buffer.from('%PDF-1.4\n%', 'latin1'),
      0xe2,
      0xe3,
      0xcf,
      0xd3,
      0x0a,
    ]),
  ];
  let posicion = trozos[0]?.length ?? 0;
  const desplazamientos: number[] = [];
  for (const [i, cuerpo] of objetos.entries()) {
    desplazamientos.push(posicion);
    const objeto = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`, 'latin1'),
      cuerpo,
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
    trozos.push(objeto);
    posicion += objeto.length;
  }
  const inicioXref = posicion;
  const xref = [
    'xref',
    `0 ${objetos.length + 1}`,
    '0000000000 65535 f ',
    ...desplazamientos.map(
      (desplazamiento) =>
        `${String(desplazamiento).padStart(10, '0')} 00000 n `,
    ),
    'trailer',
    `<< /Size ${objetos.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(inicioXref),
    '%%EOF',
  ].join('\n');
  trozos.push(Buffer.from(`${xref}\n`, 'latin1'));
  return Buffer.concat(trozos);
}
