/**
 * Tokens de inyección de los repositorios. Son `Symbol` de JavaScript, sin
 * dependencia de NestJS, para que controladores y servicios inyecten el
 * contrato sin depender de `persistencia` (nota del diagrama de paquetes).
 *
 * Programa, Curso, Cita, Asesoria e InformeRiesgo no tienen contrato
 * especializado: se inyectan como `Repositorio<T>` (instancias de
 * `RepositorioPersistente<T>` sin subclase propia).
 */
export const REPOSITORIO_PERSONA = Symbol('RepositorioPersona');
export const REPOSITORIO_CASO_RIESGO = Symbol('RepositorioCasoRiesgo');
export const REPOSITORIO_ALERTA = Symbol('RepositorioAlerta');
export const REPOSITORIO_SOLICITUD = Symbol('RepositorioSolicitud');
export const REPOSITORIO_REGISTRO_ACADEMICO = Symbol(
  'RepositorioRegistroAcademico',
);
export const REPOSITORIO_PLAN_NIVELACION = Symbol('RepositorioPlanNivelacion');
export const REPOSITORIO_PROGRAMA = Symbol('Repositorio<Programa>');
export const REPOSITORIO_CURSO = Symbol('Repositorio<Curso>');
export const REPOSITORIO_CITA = Symbol('Repositorio<Cita>');
export const REPOSITORIO_ASESORIA = Symbol('Repositorio<Asesoria>');
export const REPOSITORIO_INFORME_RIESGO = Symbol('Repositorio<InformeRiesgo>');
