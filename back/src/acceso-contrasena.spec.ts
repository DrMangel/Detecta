import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * `leerContrasenaHash` solo la pueden usar los archivos de `persistencia/`
 * (mapeador, B2) y `ServicioAutenticacion` (B3), además de su definición en
 * `persona.ts` (condición de Ivan al aprobar el plan de B2).
 */
const RAIZ = __dirname;
const ESTE_ARCHIVO = relative(RAIZ, __filename).split(sep).join('/');
const PERMITIDOS = [
  /^dominio\/entidades\/persona\.ts$/,
  /^persistencia\//,
  /^aplicacion\/servicios\/servicio-autenticacion\.ts$/,
];

function archivosTs(directorio: string): string[] {
  return readdirSync(directorio).flatMap((nombre) => {
    const ruta = join(directorio, nombre);
    if (statSync(ruta).isDirectory()) {
      return archivosTs(ruta);
    }
    return ruta.endsWith('.ts') ? [ruta] : [];
  });
}

describe('acceso a contrasenaHash', () => {
  it('leerContrasenaHash solo aparece en persona.ts, persistencia/ y ServicioAutenticacion', () => {
    const usos = archivosTs(RAIZ)
      .map((ruta) => relative(RAIZ, ruta).split(sep).join('/'))
      .filter((ruta) => ruta !== ESTE_ARCHIVO)
      .filter((ruta) =>
        readFileSync(join(RAIZ, ruta), 'utf8').includes('leerContrasenaHash'),
      );

    const noPermitidos = usos.filter(
      (ruta) => !PERMITIDOS.some((patron) => patron.test(ruta)),
    );
    expect(noPermitidos).toEqual([]);
    // Comprobación de que la búsqueda funciona: la usa el mapeador.
    expect(usos).toContain('persistencia/mapeadores/escritores.ts');
  });
});
