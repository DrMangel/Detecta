import { crearFuenteDatosMigrador } from './fuente-datos';

/**
 * Aplica o revierte las migraciones con `detecta_migrador`.
 *
 * Uso (desde back/, tras `npm run build`):
 *   node --env-file=.env dist/persistencia/ejecutar-migraciones.js <base> migrar
 *   node --env-file=.env dist/persistencia/ejecutar-migraciones.js <base> revertir
 */
export async function ejecutarMigraciones(
  nombreBase: string,
  accion: 'migrar' | 'revertir',
): Promise<string[]> {
  const fuente = crearFuenteDatosMigrador(nombreBase);
  await fuente.initialize();
  try {
    if (accion === 'migrar') {
      const aplicadas = await fuente.runMigrations({ transaction: 'each' });
      return aplicadas.map((migracion) => migracion.name);
    }
    await fuente.undoLastMigration({ transaction: 'each' });
    return [];
  } finally {
    await fuente.destroy();
  }
}

async function principal(): Promise<void> {
  const [nombreBase, accion] = process.argv.slice(2);
  if (!nombreBase || (accion !== 'migrar' && accion !== 'revertir')) {
    throw new Error('Uso: ejecutar-migraciones <base> <migrar|revertir>');
  }
  const aplicadas = await ejecutarMigraciones(nombreBase, accion);
  console.log(
    accion === 'migrar'
      ? `Migraciones aplicadas en ${nombreBase}: ${aplicadas.length === 0 ? 'ninguna pendiente' : aplicadas.join(', ')}`
      : `Última migración revertida en ${nombreBase}`,
  );
}

if (require.main === module) {
  principal().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
