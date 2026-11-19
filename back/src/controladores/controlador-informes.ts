import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import {
  DEFINICIONES_TOTALES,
  GeneradorInformeRiesgo,
} from '../aplicacion/servicios/generador-informe-riesgo';
import type { Curso } from '../dominio/entidades/curso';
import type { InformeRiesgo } from '../dominio/entidades/informe-riesgo';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import type { Persona } from '../dominio/entidades/persona';
import { Psicologo } from '../dominio/entidades/psicologo';
import type { Repositorio } from '../dominio/repositorios/repositorio';
import type { RepositorioInformeRiesgo } from '../dominio/repositorios/repositorio-informe-riesgo';
import {
  REPOSITORIO_CURSO,
  REPOSITORIO_INFORME_RIESGO,
} from '../dominio/repositorios/tokens';
import { ControladorBase } from './controlador-base';
import { conPersistencia } from './respuestas';
import { UsuarioSesion } from './sesion';
import {
  leerCuerpo,
  leerTexto,
  LONGITUD_MAXIMA,
  MENSAJE_PERIODO_OBLIGATORIO,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

/** Mensajes transcritos de sd_CUD10. */
export const MENSAJES_INFORMES = {
  sinDatos: 'No hay datos para el periodo seleccionado',
  error: 'Error al generar el informe',
} as const;

/** Solo datos agregados (respuesta 4): igual para el Jefe y el Psicólogo. */
export interface InformeDto {
  idInforme: string;
  fecha: string;
  periodo: string;
  idPrograma: string;
  curso: { idCurso: string; nombre: string };
  totalAlertas: number;
  totalCasos: number;
  totalPlanes: number;
  resumen: string;
  definiciones: typeof DEFINICIONES_TOTALES;
}

/** Respuesta HTTP mínima que se usa (Express), sin depender de sus tipos. */
interface RespuestaHttp {
  status(codigo: number): RespuestaHttp;
  set(cabeceras: Record<string, string>): RespuestaHttp;
  send(cuerpo: Buffer): void;
}

function informeDto(informe: InformeRiesgo, idPrograma: string): InformeDto {
  return {
    idInforme: informe.idInforme,
    fecha: informe.fecha.toISOString(),
    periodo: informe.periodo,
    idPrograma,
    curso: { idCurso: informe.curso.idCurso, nombre: informe.curso.nombre },
    totalAlertas: informe.totalAlertas,
    totalCasos: informe.totalCasos,
    totalPlanes: informe.totalPlanes,
    resumen: informe.resumen,
    definiciones: DEFINICIONES_TOTALES,
  };
}

/**
 * Controlador `ControladorInformes` (diagrama de clases v3; R07; sd_CUD10).
 * El Jefe consulta solo el programa que dirige (nota de sd_CUD10; ER 3.5.3)
 * y el Psicólogo, cualquier programa (ER 3.5.3).
 */
@Controller('informes')
export class ControladorInformes extends ControladorBase {
  readonly #registro = new Logger('ControladorInformes');

  constructor(
    controlAcceso: ControlAcceso,
    @Inject(REPOSITORIO_CURSO)
    private readonly cursos: Repositorio<Curso>,
    @Inject(REPOSITORIO_INFORME_RIESGO)
    private readonly informes: RepositorioInformeRiesgo,
    private readonly generador: GeneradorInformeRiesgo,
  ) {
    super(controlAcceso);
  }

  /**
   * POST /informes {periodo, idPrograma?, idCurso} → 201 con el informe, o
   * 200 {mensaje} si no hay datos (respuestas 8 y 9). `idPrograma` es
   * obligatorio para el Psicólogo y está prohibido para el Jefe (ajuste C).
   */
  @Post()
  async generarInforme(
    @UsuarioSesion() usuario: Persona,
    @Body() cuerpo: unknown,
    @Res({ passthrough: true }) respuesta: RespuestaHttp,
  ): Promise<{ informe: InformeDto } | { mensaje: string }> {
    this.#autorizado(usuario, 'generarInforme');
    const campos = leerCuerpo(cuerpo, ['periodo', 'idPrograma', 'idCurso']);
    const periodo = leerTexto(campos, 'periodo', LONGITUD_MAXIMA.periodo);
    const idCurso = leerTexto(campos, 'idCurso', LONGITUD_MAXIMA.identificador);
    const pedido = leerTexto(
      campos,
      'idPrograma',
      LONGITUD_MAXIMA.identificador,
    );
    if (periodo === '') {
      throw new BadRequestException(MENSAJE_PERIODO_OBLIGATORIO);
    }
    if (idCurso === '') {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }
    let idPrograma: string;
    if (usuario instanceof JefeDepartamento) {
      if (campos['idPrograma'] !== undefined) {
        throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
      }
      idPrograma = usuario.programa.idPrograma;
    } else {
      if (pedido === '') {
        throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
      }
      idPrograma = pedido;
    }

    const informe = await conPersistencia(
      this.#registro,
      MENSAJES_INFORMES.error,
      async () => {
        const curso = await this.cursos.buscarPorId(idCurso);
        if (curso === null) {
          throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
        }
        return this.generador.generar(periodo, idPrograma, curso, usuario);
      },
    );
    if (informe === null) {
      respuesta.status(200);
      return { mensaje: MENSAJES_INFORMES.sinDatos };
    }
    respuesta.status(201);
    return { informe: informeDto(informe, idPrograma) };
  }

  /**
   * GET /informes/:idInforme/pdf (sd_CUD10, paso 6): el Psicólogo exporta
   * cualquier informe; el Jefe solo los de su programa (403 si no).
   */
  @Get(':idInforme/pdf')
  async exportarInforme(
    @UsuarioSesion() usuario: Persona,
    @Param('idInforme') idInforme: string,
    @Res() respuesta: RespuestaHttp,
  ): Promise<void> {
    this.#autorizado(usuario, 'exportarInforme');
    if (idInforme.length > LONGITUD_MAXIMA.identificador) {
      throw new ForbiddenException();
    }
    const archivo = await conPersistencia(
      this.#registro,
      MENSAJES_INFORMES.error,
      async () => {
        const informe = await this.informes.buscarPorId(idInforme);
        if (informe === null) {
          throw new ForbiddenException();
        }
        if (usuario instanceof JefeDepartamento) {
          const programa =
            await this.informes.buscarProgramaDelInforme(idInforme);
          if (programa !== usuario.programa.idPrograma) {
            throw new ForbiddenException();
          }
        }
        return this.generador.exportar(informe);
      },
    );
    respuesta
      .status(200)
      .set({
        'Content-Type': archivo.tipoContenido,
        'Content-Disposition': `attachment; filename="${archivo.nombre}"`,
        'Content-Length': String(archivo.contenido.length),
      })
      .send(archivo.contenido);
  }

  #autorizado(usuario: Persona, accion: string): void {
    if (
      !this.verificarPermiso(usuario, accion) ||
      !(usuario instanceof JefeDepartamento || usuario instanceof Psicologo)
    ) {
      throw new ForbiddenException();
    }
  }
}
