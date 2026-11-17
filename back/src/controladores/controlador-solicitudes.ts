import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Logger,
  Post,
} from '@nestjs/common';
import {
  UNIDAD_TRABAJO,
  type UnidadTrabajo,
} from '../aplicacion/contratos/unidad-trabajo';
import { ControlAcceso } from '../aplicacion/servicios/control-acceso';
import { ServicioNotificacion } from '../aplicacion/servicios/servicio-notificacion';
import { Estudiante } from '../dominio/entidades/estudiante';
import type { Persona } from '../dominio/entidades/persona';
import { Rol } from '../dominio/entidades/rol';
import { RutaAtencion } from '../dominio/entidades/ruta-atencion';
import { ControladorBase } from './controlador-base';
import { conPersistencia, solicitud, type SolicitudDto } from './respuestas';
import { UsuarioSesion } from './sesion';
import {
  leerCuerpo,
  leerEnumerado,
  leerTexto,
  LONGITUD_MAXIMA,
  MENSAJE_SOLICITUD_NO_VALIDA,
} from './validacion-entrada';

/** Mensajes de sd_CUD02 y el texto nuevo de D21 (respuesta 1 de Ivan). */
export const MENSAJES_SOLICITUDES = {
  motivoVacio: 'Describa el motivo de la solicitud',
  errorRegistro: 'No fue posible registrar la solicitud. Intente de nuevo',
  /** Texto nuevo (no viene del ER). */
  sinMatricula: 'No se encontró una matrícula activa asociada a su cuenta.',
} as const;

const TIPOS_APOYO = Object.values(RutaAtencion);

/**
 * Controlador `ControladorSolicitudes` (diagrama de clases v3; R02, sd_CUD02).
 *
 * - Matrícula activa (D21, respuesta 1): al menos un RegistroAcademico del
 *   estudiante. Limitación: quien deja de venir en la fuente conserva sus
 *   registros (D20).
 * - El código de rastreo es `idOrigen` (D28).
 * - La solicitud y su caso confidencial se guardan en una transacción
 *   (primero el origen, D7); el correo genérico a los destinatarios se lanza
 *   después del commit y no se espera.
 */
@Controller('solicitudes')
export class ControladorSolicitudes extends ControladorBase {
  readonly #registro = new Logger('ControladorSolicitudes');

  constructor(
    controlAcceso: ControlAcceso,
    @Inject(UNIDAD_TRABAJO)
    private readonly unidadTrabajo: UnidadTrabajo,
    private readonly notificacion: ServicioNotificacion,
  ) {
    super(controlAcceso);
  }

  /** POST /solicitudes {tipoApoyo, motivo, disponibilidad?} → 201 con el comprobante. */
  @Post()
  @HttpCode(201)
  async radicarSolicitud(
    @UsuarioSesion() usuario: Persona,
    @Body() cuerpo: unknown,
  ): Promise<SolicitudDto> {
    if (
      !this.verificarPermiso(usuario, 'radicarSolicitud') ||
      !(usuario instanceof Estudiante)
    ) {
      throw new ForbiddenException();
    }
    const estudiante = usuario;
    const campos = leerCuerpo(cuerpo, [
      'tipoApoyo',
      'motivo',
      'disponibilidad',
    ]);
    const tipoApoyo = leerEnumerado(campos, 'tipoApoyo', TIPOS_APOYO);
    const motivo = leerTexto(campos, 'motivo', LONGITUD_MAXIMA.motivo);
    // Disponibilidad no es obligatoria (ajuste C); se guarda vacía.
    const disponibilidad = leerTexto(
      campos,
      'disponibilidad',
      LONGITUD_MAXIMA.disponibilidad,
    );
    if (tipoApoyo === null) {
      throw new BadRequestException(MENSAJE_SOLICITUD_NO_VALIDA);
    }
    if (motivo === '') {
      throw new BadRequestException(MENSAJES_SOLICITUDES.motivoVacio);
    }

    const { origen, caso, destinatarios } = await conPersistencia(
      this.#registro,
      MENSAJES_SOLICITUDES.errorRegistro,
      () =>
        this.unidadTrabajo.ejecutar(async (repos) => {
          const registros = await repos.registros.listar(
            new Map([['idEstudiante', estudiante.id]]),
          );
          if (registros.length === 0) {
            throw new ForbiddenException(MENSAJES_SOLICITUDES.sinMatricula);
          }
          const nueva = estudiante.solicitarAcompanamiento(
            tipoApoyo,
            motivo,
            disponibilidad,
          );
          const casoNuevo = nueva.generarCasoRiesgo();
          await repos.solicitudes.guardar(nueva);
          await repos.casos.guardar(casoNuevo);
          // Destino según la categoría (R02 paso 6; ER 3.7 f).
          const receptores =
            tipoApoyo === RutaAtencion.PSICOLOGICA
              ? await repos.personas.listarPorRol(Rol.PSICOLOGO)
              : await repos.personas.buscarJefePorPrograma(
                  estudiante.obtenerPrograma().idPrograma,
                );
          return {
            origen: nueva,
            caso: casoNuevo,
            destinatarios: Array.isArray(receptores)
              ? receptores
              : receptores === null
                ? []
                : [receptores],
          };
        }),
    );

    if (destinatarios.length === 0) {
      // Respuesta 8: se guarda igual; solo se omite el correo.
      this.#registro.warn(
        `Solicitud ${tipoApoyo} sin destinatarios: no se envía la notificación del caso remitido`,
      );
    } else {
      void this.notificacion.notificarCasoRemitido(caso, destinatarios);
    }
    return solicitud(origen, caso.estado);
  }
}
