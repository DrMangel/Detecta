import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AppModule, CONEXION_INSTITUCIONAL } from '../src/app.module';

/**
 * Criterio de cierre de B0 (docs/plan-backend.md): el backend conecta a las
 * dos bases, `detecta` e `institucional_demo`. Requiere Docker con el
 * contenedor de PostgreSQL en marcha y back/.env completo.
 */
describe('Conexión a las bases de datos (B0)', () => {
  let detecta: DataSource;
  let institucional: DataSource;
  let cerrar: () => Promise<void>;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = await modulo.init();
    cerrar = () => app.close();

    detecta = modulo.get<DataSource>(getDataSourceToken());
    institucional = modulo.get<DataSource>(
      getDataSourceToken(CONEXION_INSTITUCIONAL),
    );
  });

  afterAll(async () => {
    await cerrar();
  });

  it('conecta a la base detecta con el usuario de la aplicación', async () => {
    const filas: { base: string; usuario: string }[] = await detecta.query(
      'SELECT current_database() AS base, current_user AS usuario',
    );

    expect(filas[0]?.base).toBe(process.env['BD_DETECTA_NOMBRE']);
    expect(filas[0]?.usuario).toBe(process.env['BD_DETECTA_USUARIO']);
  });

  it('conecta a la base institucional_demo con el usuario lector', async () => {
    const filas: { base: string; usuario: string }[] =
      await institucional.query(
        'SELECT current_database() AS base, current_user AS usuario',
      );

    expect(filas[0]?.base).toBe(process.env['BD_INSTITUCIONAL_NOMBRE']);
    expect(filas[0]?.usuario).toBe(process.env['BD_INSTITUCIONAL_USUARIO']);
  });

  it('abre la conexión institucional en modo de solo lectura', async () => {
    const filas: { default_transaction_read_only: string }[] =
      await institucional.query('SHOW default_transaction_read_only');

    expect(filas[0]?.default_transaction_read_only).toBe('on');
  });
});
