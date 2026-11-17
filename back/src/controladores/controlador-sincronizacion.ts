import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorConectorInstitucional } from '../aplicacion/contratos/conector-bd-institucional';
import { RecursoOcupadoError } from '../aplicacion/contratos/unidad-trabajo';
import {
  CONFIGURACION_SINCRONIZACION,
  type ConfiguracionSincronizacion,
} from '../aplicacion/servicios/programador-sincronizacion';
import {
  MENSAJE_SINCRONIZACION_EN_CURSO,
  ServicioSincronizacion,
  type ResultadoSincronizacion,
} from '../aplicacion/servicios/servicio-sincronizacion';
import { Publico } from './sesion';

/** Compara en tiempo constante (digests de igual longitud). */
export function secretosIguales(recibido: string, esperado: string): boolean {
  const a = createHash('sha256').update(recibido, 'utf8').digest();
  const b = createHash('sha256').update(esperado, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * Controlador `ControladorSincronizacion` (diagrama de clases v3:
 * `ejecutarSincronizacion(): Integer`). No hereda de ControladorBase: no lo
 * usa ningún rol del sistema (nota del diagrama, línea base §4). Es el
 * disparo manual del administrador "desde las herramientas del despliegue".
 *
 * Fuera del diagrama (respuesta 8 de Ivan): la ruta `POST /sincronizacion`,
 * protegida con `Authorization: Bearer <SINCRONIZACION_SECRETO>` comparado en
 * tiempo constante; si el secreto no está configurado la ruta responde 404.
 * El secreto nunca se registra. Devuelve el resultado completo (el diagrama
 * devuelve solo el número de registros actualizados).
 */
@Publico()
@Controller('sincronizacion')
export class ControladorSincronizacion {
  constructor(
    private readonly servicio: ServicioSincronizacion,
    @Inject(CONFIGURACION_SINCRONIZACION)
    private readonly configuracion: ConfiguracionSincronizacion,
  ) {}

  @Post()
  @HttpCode(200)
  async ejecutarSincronizacion(
    @Headers('authorization') autorizacion: string | undefined,
  ): Promise<ResultadoSincronizacion> {
    const secreto = this.configuracion.secreto;
    if (secreto === null) {
      throw new NotFoundException();
    }
    const recibido = /^Bearer (.+)$/.exec(autorizacion ?? '')?.[1] ?? '';
    if (!secretosIguales(recibido, secreto)) {
      throw new UnauthorizedException('Secreto de sincronización no válido');
    }
    try {
      await this.servicio.sincronizarTodo();
    } catch (error) {
      if (error instanceof RecursoOcupadoError) {
        throw new ConflictException(MENSAJE_SINCRONIZACION_EN_CURSO);
      }
      if (error instanceof ErrorConectorInstitucional) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
    const resultado = this.servicio.obtenerUltimoResultado();
    if (resultado === null) {
      throw new Error('La sincronización no produjo un resultado');
    }
    return resultado;
  }
}
