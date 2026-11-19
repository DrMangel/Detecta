import { Module } from '@nestjs/common';
import { ControladorAlertas } from './controlador-alertas';
import { ControladorConsultaEstudiante } from './controlador-consulta-estudiante';
import { ControladorSolicitudes } from './controlador-solicitudes';
import { ModuloAcceso } from './modulo-acceso';
import { ModuloNotificacion } from './modulo-notificacion';

/**
 * Flujos del docente y del estudiante (fase B6: R01, R02 y CUD01; módulo
 * fuera del diagrama). ControlAcceso llega de ModuloAcceso y
 * ServicioNotificacion de ModuloNotificacion; los repositorios y la
 * UnidadTrabajo, por token desde el módulo global de persistencia.
 */
@Module({
  imports: [ModuloAcceso, ModuloNotificacion],
  controllers: [
    ControladorAlertas,
    ControladorConsultaEstudiante,
    ControladorSolicitudes,
  ],
})
export class ModuloAlertasSolicitudes {}
