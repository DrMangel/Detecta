import { Global, Module, type Provider } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  REPOSITORIO_ALERTA,
  REPOSITORIO_ASESORIA,
  REPOSITORIO_CASO_RIESGO,
  REPOSITORIO_CITA,
  REPOSITORIO_CREDENCIALES,
  REPOSITORIO_CURSO,
  REPOSITORIO_INFORME_RIESGO,
  REPOSITORIO_PERSONA,
  REPOSITORIO_PLAN_NIVELACION,
  REPOSITORIO_PROGRAMA,
  REPOSITORIO_REGISTRO_ACADEMICO,
  REPOSITORIO_SOLICITUD,
} from '../dominio/repositorios/tokens';
import { UNIDAD_TRABAJO } from '../aplicacion/contratos/unidad-trabajo';
import { RepositorioPersistenteCredenciales } from './repositorio-persistente-credenciales';
import { UnidadTrabajoPersistente } from './unidad-trabajo-persistente';
import {
  crearRepositorioAsesoria,
  crearRepositorioCita,
  crearRepositorioCurso,
  crearRepositorioInformeRiesgo,
  crearRepositorioPrograma,
} from './repositorios-genericos';
import {
  RepositorioPersistenteAlerta,
  RepositorioPersistenteCasoRiesgo,
  RepositorioPersistentePersona,
  RepositorioPersistentePlanNivelacion,
  RepositorioPersistenteRegistroAcademico,
  RepositorioPersistenteSolicitud,
} from './repositorios-persistentes';

/** Registra un adaptador sobre la conexión por defecto (base `detecta`). */
function proveedor(
  token: symbol,
  crear: (fuente: DataSource) => unknown,
): Provider {
  return { provide: token, useFactory: crear, inject: [DataSource] };
}

const PROVEEDORES: Provider[] = [
  proveedor(REPOSITORIO_PERSONA, (f) => new RepositorioPersistentePersona(f)),
  proveedor(
    REPOSITORIO_CASO_RIESGO,
    (f) => new RepositorioPersistenteCasoRiesgo(f),
  ),
  proveedor(REPOSITORIO_ALERTA, (f) => new RepositorioPersistenteAlerta(f)),
  proveedor(
    REPOSITORIO_SOLICITUD,
    (f) => new RepositorioPersistenteSolicitud(f),
  ),
  proveedor(
    REPOSITORIO_REGISTRO_ACADEMICO,
    (f) => new RepositorioPersistenteRegistroAcademico(f),
  ),
  proveedor(
    REPOSITORIO_PLAN_NIVELACION,
    (f) => new RepositorioPersistentePlanNivelacion(f),
  ),
  proveedor(REPOSITORIO_PROGRAMA, crearRepositorioPrograma),
  proveedor(REPOSITORIO_CURSO, crearRepositorioCurso),
  proveedor(REPOSITORIO_CITA, crearRepositorioCita),
  proveedor(REPOSITORIO_ASESORIA, crearRepositorioAsesoria),
  proveedor(REPOSITORIO_INFORME_RIESGO, crearRepositorioInformeRiesgo),
  proveedor(
    REPOSITORIO_CREDENCIALES,
    (f) => new RepositorioPersistenteCredenciales(f),
  ),
  // B4: transacciones definidas por los servicios (Manual 4.1.1.4).
  proveedor(UNIDAD_TRABAJO, (f) => new UnidadTrabajoPersistente(f)),
];

/**
 * Módulo de persistencia: inyecta los adaptadores al iniciar (nota del
 * diagrama de paquetes). Controladores y servicios dependen solo de los
 * contratos de `dominio/repositorios` y de sus tokens. Es global para que
 * los módulos de controladores reciban los repositorios por token sin
 * importar código de `persistencia`.
 */
@Global()
@Module({
  providers: PROVEEDORES,
  exports: PROVEEDORES,
})
export class ModuloPersistencia {}
