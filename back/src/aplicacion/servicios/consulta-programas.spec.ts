import type { Programa } from '../../dominio/entidades/programa';
import type { Repositorio } from '../../dominio/repositorios/repositorio';
import { ConsultaProgramas } from './consulta-programas';

describe('ConsultaProgramas (B10)', () => {
  it('proyecta solo id y nombre y ordena con la configuración regional española', async () => {
    const programas = [
      { idPrograma: 'P5', nombre: 'zoología' },
      { idPrograma: 'P4', nombre: 'Psicología' },
      { idPrograma: 'P3', nombre: 'asesoría' },
      { idPrograma: 'P2', nombre: 'Álgebra' },
      { idPrograma: 'P1', nombre: 'algebra' },
    ];
    const repositorio = { listar: jest.fn().mockResolvedValue(programas) };
    const consulta = new ConsultaProgramas(
      repositorio as unknown as Repositorio<Programa>,
    );

    await expect(consulta.ejecutar()).resolves.toEqual([
      { idPrograma: 'P1', nombre: 'algebra' },
      { idPrograma: 'P2', nombre: 'Álgebra' },
      { idPrograma: 'P3', nombre: 'asesoría' },
      { idPrograma: 'P4', nombre: 'Psicología' },
      { idPrograma: 'P5', nombre: 'zoología' },
    ]);
    expect(repositorio.listar).toHaveBeenCalledWith(new Map());
  });

  it('devuelve una lista vacía cuando no hay programas', async () => {
    const repositorio = { listar: jest.fn().mockResolvedValue([]) };
    const consulta = new ConsultaProgramas(
      repositorio as unknown as Repositorio<Programa>,
    );

    await expect(consulta.ejecutar()).resolves.toEqual([]);
  });
});
