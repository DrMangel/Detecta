import { Inject, Injectable } from '@nestjs/common';
import type { Programa } from '../../dominio/entidades/programa';
import type { Repositorio } from '../../dominio/repositorios/repositorio';
import { REPOSITORIO_PROGRAMA } from '../../dominio/repositorios/tokens';

export interface ProgramaDto {
  idPrograma: string;
  nombre: string;
}

/** Consulta de solo lectura para el selector de programa de CUD10 (B10). */
@Injectable()
export class ConsultaProgramas {
  constructor(
    @Inject(REPOSITORIO_PROGRAMA)
    private readonly programas: Repositorio<Programa>,
  ) {}

  async ejecutar(): Promise<ProgramaDto[]> {
    const filas = await this.programas.listar(new Map());
    return filas
      .map(({ idPrograma, nombre }) => ({ idPrograma, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
}
