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
import { ProveedorCorreoDesactivado } from './proveedor-correo-desactivado';
import { ProveedorCorreoExterno } from './proveedor-correo-externo';

/**
 * Adaptadores de integración inyectados al iniciar (nota del diagrama de
 * paquetes). Global para que los servicios reciban sus contratos por token
 * sin importar código de `integracion`.
 *
 * - ProveedorCorreo (B5): ProveedorCorreoExterno (SMTP/TLS con Brevo), o
 *   ProveedorCorreoDesactivado si se declara CORREO_MODO=desactivado (nunca
 *   en producción). Reemplaza al provisional de B3.
 * - ConectorBDInstitucional: ConectorBDConfigurable sobre la conexión
 *   `institucional` de B0 (solo lectura), con el origen y el mapeo del JSON
 *   indicado por CONECTOR_CONFIGURACION (B4).
 */
@Global()
@Module({
  providers: [
    {
      provide: PROVEEDOR_CORREO,
      inject: [ConfigService],
      useFactory: (config: ConfigService<VariablesEntorno, true>) => {
        const correo = config.get('CORREO', { infer: true });
        return correo.modo === 'desactivado'
          ? new ProveedorCorreoDesactivado()
          : new ProveedorCorreoExterno({
              host: correo.host,
              puerto: correo.puerto,
              usuario: correo.usuario,
              clave: correo.clave,
              remitente: correo.remitente,
              remitenteNombre: correo.remitenteNombre,
              rechazarEjemploInvalid: config.get(
                'CORREO_RECHAZAR_EJEMPLO_INVALID',
                { infer: true },
              ),
              destinoPermitido: config.get('CORREO_DESTINO_PERMITIDO', {
                infer: true,
              }),
            });
      },
    },
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
