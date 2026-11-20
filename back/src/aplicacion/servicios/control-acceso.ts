import { Injectable } from '@nestjs/common';
import type { CasoRiesgo } from '../../dominio/entidades/caso-riesgo';
import { JefeDepartamento } from '../../dominio/entidades/jefe-departamento';
import type { Persona } from '../../dominio/entidades/persona';
import { Rol } from '../../dominio/entidades/rol';
import { RutaAtencion } from '../../dominio/entidades/ruta-atencion';
import { SolicitudAcompanamiento } from '../../dominio/entidades/solicitud-acompanamiento';

/**
 * Matriz de permisos aprobada en el plan de B3. Las acciones son las cadenas
 * exactas de `verificarPermiso` en los diagramas de secuencia. Lo que no está
 * en la matriz se deniega.
 *
 * - `listarCasosPendiente` es la cadena de sd_CUD04; el método del
 *   controlador sigue el diagrama de clases (`listarCasosPendientes`).
 *   Diferencia reportada (respuesta 11 de Ivan).
 * - `ejecutarSincronizacion` no está para ningún rol: ControladorSincronizacion
 *   no hereda de ControladorBase (línea base §4).
 * - La propiedad del recurso ("sus cursos", "su programa", ER 3.5.3) la
 *   verifica cada controlador en B6 a B8.
 */
export const MATRIZ_PERMISOS: Readonly<Record<Rol, readonly string[]>> = {
  // sd_CUD01 (actor Estudiante), sd_CUD02; ER 3.5.3, R02.
  [Rol.ESTUDIANTE]: [
    'consultarRegistros',
    'consultarAlertas',
    'consultarSolicitudes',
    'radicarSolicitud',
  ],
  // sd_CUD01 (actor Docente), sd_CUD03; ER 3.5.3, R01.
  [Rol.DOCENTE]: ['consultarCurso', 'consultarAlertasEmitidas', 'emitirAlerta'],
  // sd_CUD04 (con la nota de la extensión 1.a de CUD05), sd_CUD10; R03, R04, R07.
  [Rol.JEFE_DEPARTAMENTO]: [
    'listarCasosPendiente',
    'canalizarCaso',
    'estructurarPlan',
    'finalizarPlan',
    'generarInforme',
    'exportarInforme',
  ],
  // sd_CUD06 (incluye CUD07, CUD08 y CUD09), sd_CUD10; R05, R06, R07.
  [Rol.PSICOLOGO]: [
    'listarProgramas',
    'listarCasosPsicologo',
    'evaluarPertinencia',
    'programarCita',
    'reprogramarCita',
    'registrarResultado',
    'confirmarConsentimiento',
    'programarSeguimiento',
    'cerrarCaso',
    'generarInforme',
    'exportarInforme',
  ],
};

/** Servicio `ControlAcceso` (diagrama de clases v3). */
@Injectable()
export class ControlAcceso {
  /**
   * Indica si el rol del usuario puede ejecutar la acción (ER 3.7 c: "cada
   * usuario solo debe poder ver y ejecutar las funciones correspondientes a
   * su rol"). El rol sale de la persona cargada de la BD, nunca del token.
   */
  puedeEjecutar(usuario: Persona, accion: string): boolean {
    return MATRIZ_PERMISOS[usuario.obtenerRol()].includes(accion);
  }

  /**
   * Contenido confidencial del caso (motivo y disponibilidad de la solicitud;
   * expediente psicológico).
   *
   * - Psicólogo (D19): casos de la ruta PSICOLOGICA sin psicólogo o asignados
   *   a él (ER 3.7 c, ER 3.5.3; Manual CU_12). Incluye la solicitud académica
   *   que el Jefe canalizó a psicología (D18, respuesta 1 del plan de B7).
   * - Jefe de Departamento (D18; ER 3.5.3, 3.7 c y "Funciones de control";
   *   Manual CUD02): el motivo y la disponibilidad de una solicitud ACADEMICA
   *   de un estudiante del programa que dirige, mientras el caso no se
   *   canalice a la ruta psicológica. Nunca el expediente: una solicitud
   *   académica sin ruta psicológica no tiene citas.
   */
  puedeVerContenidoConfidencial(usuario: Persona, caso: CasoRiesgo): boolean {
    if (usuario.obtenerRol() === Rol.PSICOLOGO) {
      if (caso.ruta !== RutaAtencion.PSICOLOGICA) {
        return false;
      }
      return caso.psicologo === null || caso.psicologo.id === usuario.id;
    }
    if (usuario instanceof JefeDepartamento) {
      return (
        caso.confidencialidad &&
        caso.origen instanceof SolicitudAcompanamiento &&
        caso.origen.tipoApoyo === RutaAtencion.ACADEMICA &&
        caso.ruta !== RutaAtencion.PSICOLOGICA &&
        caso.obtenerEstudiante().obtenerPrograma().idPrograma ===
          usuario.programa.idPrograma
      );
    }
    return false;
  }
}
