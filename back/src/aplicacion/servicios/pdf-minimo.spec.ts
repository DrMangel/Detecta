import {
  cadenaPdf,
  CARACTERES_POR_LINEA,
  generarPdf,
  LINEAS_POR_PAGINA,
  partirLineas,
} from './pdf-minimo';

/** Verificación estructural de un PDF (ajuste A del plan de B8). */
function estructura(pdf: Buffer) {
  const texto = pdf.toString('latin1');
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(texto)?.[1]);
  const xref = texto.slice(startxref);
  const [, inicio, cantidad] = /^xref\n(\d+) (\d+)\n/.exec(xref) ?? [];
  const entradas = xref
    .split('\n')
    .slice(2, 2 + Number(cantidad))
    .map((linea) => ({ desplazamiento: Number(linea.slice(0, 10)), linea }));
  return {
    texto,
    startxref,
    inicio: Number(inicio),
    cantidad: Number(cantidad),
    entradas,
  };
}

describe('Generador de PDF mínimo (B8, ajuste A)', () => {
  it('empieza por %PDF-, termina en %%EOF y la xref apunta a cada objeto', () => {
    const pdf = generarPdf(['Hola', 'Segunda línea']);
    const { texto, startxref, inicio, cantidad, entradas } = estructura(pdf);
    expect(texto.startsWith('%PDF-1.4\n')).toBe(true);
    expect(texto.endsWith('%%EOF\n')).toBe(true);
    expect(texto.slice(startxref, startxref + 4)).toBe('xref');
    expect(inicio).toBe(0);
    expect(entradas[0]?.linea).toBe('0000000000 65535 f ');
    for (const [i, entrada] of entradas.slice(1).entries()) {
      expect(
        texto.slice(entrada.desplazamiento).startsWith(`${i + 1} 0 obj\n`),
      ).toBe(true);
      // Cada entrada de la xref mide 20 bytes con el salto de línea.
      expect(entrada.linea.length + 1).toBe(20);
    }
    expect(texto).toContain(`/Size ${cantidad}`);
  });

  it('el /Length de cada flujo coincide con sus bytes', () => {
    const pdf = generarPdf(['Ñandú (prueba) \\ fin']).toString('latin1');
    for (const coincidencia of pdf.matchAll(
      /<< \/Length (\d+) >>\nstream\n/g,
    )) {
      const desde = (coincidencia.index ?? 0) + coincidencia[0].length;
      const hasta = pdf.indexOf('\nendstream', desde);
      expect(hasta - desde).toBe(Number(coincidencia[1]));
    }
  });

  it('escapa paréntesis y barras invertidas', () => {
    expect(cadenaPdf('a(b)c\\d').toString('latin1')).toBe('(a\\(b\\)c\\\\d)');
  });

  it('codifica tildes, ñ y comillas tipográficas en WinAnsi; lo no representable es "?"', () => {
    expect([...cadenaPdf('áéíóúÁÉÍÓÚñÑüÜ')]).toEqual([
      0x28, 0xe1, 0xe9, 0xed, 0xf3, 0xfa, 0xc1, 0xc9, 0xcd, 0xd3, 0xda, 0xf1,
      0xd1, 0xfc, 0xdc, 0x29,
    ]);
    expect([...cadenaPdf('“—€')]).toEqual([0x28, 0x93, 0x97, 0x80, 0x29]);
    expect(cadenaPdf('😀漢').toString('latin1')).toBe('(??)');
  });

  it('reparte las líneas en páginas con un límite por página', () => {
    const lineas = Array.from(
      { length: LINEAS_POR_PAGINA * 2 + 1 },
      (_, i) => `Línea ${i}`,
    );
    const texto = generarPdf(lineas).toString('latin1');
    expect(texto).toContain('/Count 3');
    expect(texto.match(/\/Type \/Page /g)).toHaveLength(3);
    const flujos = [...texto.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(
      (m) => m[1] ?? '',
    );
    expect(flujos.map((f) => (f.match(/ '\n/g) ?? []).length)).toEqual([
      LINEAS_POR_PAGINA,
      LINEAS_POR_PAGINA,
      1,
    ]);
  });

  it('parte las líneas largas por palabras sin perder texto', () => {
    const larga = 'palabra '.repeat(30).trim();
    const partes = partirLineas([larga]);
    expect(partes.every((p) => p.length <= CARACTERES_POR_LINEA)).toBe(true);
    expect(partes.join(' ')).toBe(larga);
    expect(partirLineas(['x'.repeat(CARACTERES_POR_LINEA + 5)])).toEqual([
      'x'.repeat(CARACTERES_POR_LINEA),
      'x'.repeat(5),
    ]);
  });

  it('un documento sin líneas tiene una página', () => {
    expect(generarPdf([]).toString('latin1')).toContain('/Count 1');
  });
});
