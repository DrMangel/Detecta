import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ControlAcceso } from '../../src/aplicacion/servicios/control-acceso';
import { ControladorBase } from '../../src/controladores/controlador-base';
import { UsuarioSesion } from '../../src/controladores/sesion';
import type { Persona } from '../../src/dominio/entidades/persona';
import type { RepositorioCasoRiesgo } from '../../src/dominio/repositorios/repositorio-caso-riesgo';
import { REPOSITORIO_CASO_RIESGO } from '../../src/dominio/repositorios/tokens';

/**
 * Controlador SOLO DE PRUEBA (no forma parte de la aplicación): hereda de
 * ControladorBase para verificar, con HTTP real, el rechazo por rol y la
 * regla de contenido confidencial antes de que existan los controladores de
 * negocio (B6 a B8).
 */
@Controller('prueba')
export class ControladorPrueba extends ControladorBase {
  constructor(
    controlAcceso: ControlAcceso,
    @Inject(REPOSITORIO_CASO_RIESGO)
    private readonly casos: RepositorioCasoRiesgo,
  ) {
    super(controlAcceso);
  }

  /** Ejecuta una acción de la matriz: 200 si el rol la tiene, 403 si no. */
  @Get('accion/:accion')
  ejecutar(
    @Param('accion') accion: string,
    @UsuarioSesion() usuario: Persona,
  ): { accion: string } {
    if (!this.verificarPermiso(usuario, accion)) {
      throw new ForbiddenException('No tiene permiso para esta acción');
    }
    return { accion };
  }

  /** Devuelve el motivo del caso solo si el usuario puede ver lo confidencial. */
  @Get('caso/:idCaso')
  async caso(
    @Param('idCaso') idCaso: string,
    @UsuarioSesion() usuario: Persona,
  ): Promise<{ idCaso: string; motivo: string | null }> {
    const caso = await this.casos.buscarPorId(idCaso);
    if (!caso) {
      throw new NotFoundException();
    }
    return {
      idCaso: caso.idCaso,
      motivo: this.controlAcceso.puedeVerContenidoConfidencial(usuario, caso)
        ? caso.motivo
        : null,
    };
  }
}
