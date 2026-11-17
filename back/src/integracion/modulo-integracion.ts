import { Global, Module } from '@nestjs/common';
import { PROVEEDOR_CORREO } from '../aplicacion/contratos/proveedor-correo';
import { ProveedorCorreoSinEnvio } from './proveedor-correo-sin-envio';

/**
 * Adaptadores de integración inyectados al iniciar (nota del diagrama de
 * paquetes). Global para que los servicios reciban `ProveedorCorreo` por su
 * token sin importar código de `integracion`.
 */
@Global()
@Module({
  providers: [{ provide: PROVEEDOR_CORREO, useClass: ProveedorCorreoSinEnvio }],
  exports: [PROVEEDOR_CORREO],
})
export class ModuloIntegracion {}
