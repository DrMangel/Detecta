import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { CONECTOR_BD_INSTITUCIONAL } from '../aplicacion/contratos/conector-bd-institucional';
import { PROVEEDOR_CORREO } from '../aplicacion/contratos/proveedor-correo';
import { CONEXION_INSTITUCIONAL } from '../conexiones';
import type { Curso } from '../dominio/entidades/curso';
import type { Programa } from '../dominio/entidades/programa';
import type { Repositorio } from '../dominio/repositorios/repositorio';
import {
  REPOSITORIO_CURSO,
  REPOSITORIO_PROGRAMA,
} from '../dominio/repositorios/tokens';
import type { VariablesEntorno } from '../validacion-entorno';
import { ConectorBDConfigurable } from './conector-bd-configurable';
import { cargarConfiguracionConector } from './configuracion-conector';
import { ProveedorCorreoSinEnvio } from './proveedor-correo-sin-envio';

/**
 * Adaptadores de integración inyectados al iniciar (nota del diagrama de
 * paquetes). Global para que los servicios reciban sus contratos por token
 * sin importar código de `integracion`.
 *
 * - ProveedorCorreo: provisional sin envío hasta B5.
 * - ConectorBDInstitucional: ConectorBDConfigurable sobre la conexión
 *   `institucional` de B0 (solo lectura), con el origen y el mapeo del JSON
 *   indicado por CONECTOR_CONFIGURACION (B4).
 */
@Global()
@Module({
  providers: [
    { provide: PROVEEDOR_CORREO, useClass: ProveedorCorreoSinEnvio },
    {
      provide: CONECTOR_BD_INSTITUCIONAL,
      inject: [
        getDataSourceToken(CONEXION_INSTITUCIONAL),
        ConfigService,
        REPOSITORIO_PROGRAMA,
        REPOSITORIO_CURSO,
      ],
      useFactory: (
        fuente: DataSource,
        config: ConfigService<VariablesEntorno, true>,
        programas: Repositorio<Programa>,
        cursos: Repositorio<Curso>,
      ) =>
        new ConectorBDConfigurable({
          fuente,
          configuracion: cargarConfiguracionConector(
            config.get('CONECTOR_CONFIGURACION', { infer: true }),
          ),
          programas,
          cursos,
          reloj: () => new Date(),
        }),
    },
  ],
  exports: [PROVEEDOR_CORREO, CONECTOR_BD_INSTITUCIONAL],
})
export class ModuloIntegracion {}
