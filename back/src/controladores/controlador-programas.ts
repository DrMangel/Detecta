import { Controller, ForbiddenException, Get } from '@nestjs/common';
import {
  ConsultaProgramas,
  type ProgramaDto,
} from '../aplicacion/servicios/consulta-programas';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import type { Persona } from '../dominio/entidades/persona';
import { ControladorBase } from './controlador-base';
import { UsuarioSesion } from './sesion';

/** Consulta de programas para informes del Psicólogo (CUD10, B10). */
@Controller('programas')
export class ControladorProgramas extends ControladorBase {
  constructor(
    controlAcceso: ControlAcceso,
    private readonly consulta: ConsultaProgramas,
  ) {
    super(controlAcceso);
  }

  @Get()
  listar(@UsuarioSesion() usuario: Persona): Promise<ProgramaDto[]> {
    if (!this.verificarPermiso(usuario, 'listarProgramas')) {
      throw new ForbiddenException();
    }
    return this.consulta.ejecutar();
  }
}
