import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Nota del diagrama de paquetes: "no hay dependencia de código desde
 * controladores ni servicios hacia persistencia o integracion; los
 * adaptadores se inyectan al iniciar (módulos de NestJS)". Tampoco el
 * dominio depende de ninguna otra capa.
 */
const RAIZ = __dirname;

function archivosTs(directorio: string): string[] {
  return readdirSync(directorio).flatMap((nombre) => {
    const ruta = join(directorio, nombre);
    if (statSync(ruta).isDirectory()) {
      return archivosTs(ruta);
    }
    return ruta.endsWith('.ts') ? [ruta] : [];
  });
}

function importacionesProhibidas(
  carpeta: string,
  prohibidas: RegExp,
): string[] {
  return archivosTs(join(RAIZ, carpeta)).flatMap((ruta) => {
    const nombre = relative(RAIZ, ruta).split(sep).join('/');
    return [...readFileSync(ruta, 'utf8').matchAll(/from '([^']+)'/g)]
      .map((coincidencia) => coincidencia[1] ?? '')
      .filter((destino) => prohibidas.test(destino))
      .map((destino) => `${nombre} → ${destino}`);
  });
}

describe('dependencias entre capas (diagrama de paquetes)', () => {
  it('controladores no importa persistencia ni integracion', () => {
    expect(
      importacionesProhibidas(
        'controladores',
        /\/(persistencia|integracion)\//,
      ),
    ).toEqual([]);
  });

  it('aplicacion no importa persistencia, integracion ni controladores', () => {
    expect(
      importacionesProhibidas(
        'aplicacion',
        /\/(persistencia|integracion|controladores)\//,
      ),
    ).toEqual([]);
  });

  it('dominio no importa ninguna otra capa ni frameworks', () => {
    expect(
      importacionesProhibidas(
        'dominio',
        /\/(persistencia|integracion|controladores|aplicacion)\/|^@nestjs|^typeorm|^bcrypt/,
      ),
    ).toEqual([]);
  });
});
