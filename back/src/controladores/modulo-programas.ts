import { Module } from '@nestjs/common';
import { ConsultaProgramas } from '../aplicacion/servicios/consulta-programas';
import { ControladorProgramas } from './controlador-programas';
import { ModuloAcceso } from './modulo-acceso';

@Module({
  imports: [ModuloAcceso],
  controllers: [ControladorProgramas],
  providers: [ConsultaProgramas],
})
export class ModuloProgramas {}
