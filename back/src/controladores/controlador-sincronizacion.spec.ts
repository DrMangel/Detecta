import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ErrorConectorInstitucional,
  MENSAJES_TABLA_2,
} from '../aplicacion/contratos/conector-bd-institucional';
import { RecursoOcupadoError } from '../aplicacion/contratos/unidad-trabajo';
import {
  MENSAJE_SINCRONIZACION_EN_CURSO,
  type ServicioSincronizacion,
} from '../aplicacion/servicios/servicio-sincronizacion';
import {
  ControladorSincronizacion,
  secretosIguales,
} from './controlador-sincronizacion';

const SECRETO = 's'.repeat(40);

function controlador(
  sincronizarTodo: jest.Mock,
  secreto: string | null = SECRETO,
): ControladorSincronizacion {
  const servicio = {
    sincronizarTodo,
    obtenerUltimoResultado: () => ({ actualizados: 1 }),
  } as unknown as ServicioSincronizacion;
  return new ControladorSincronizacion(servicio, {
    horaNocturna: null,
    secreto,
  });
}

describe('ControladorSincronizacion', () => {
  it('404 si el secreto no está configurado', async () => {
    await expect(
      controlador(jest.fn(), null).ejecutarSincronizacion(`Bearer ${SECRETO}`),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('401 sin cabecera o con secreto erróneo', async () => {
    const sincronizar = jest.fn();
    await expect(
      controlador(sincronizar).ejecutarSincronizacion(undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controlador(sincronizar).ejecutarSincronizacion('Bearer otro'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('409 con el mensaje "sincronización en curso" si ya hay una en curso', async () => {
    const error = await controlador(
      jest.fn().mockRejectedValue(new RecursoOcupadoError('x')),
    )
      .ejecutarSincronizacion(`Bearer ${SECRETO}`)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toBe(MENSAJE_SINCRONIZACION_EN_CURSO);
    expect(MENSAJE_SINCRONIZACION_EN_CURSO).toBe(
      'Ya hay una sincronización en curso; intente más tarde.',
    );
  });

  it('503 con el mensaje de la Tabla 2 ante un error de conexión', async () => {
    const error = await controlador(
      jest
        .fn()
        .mockRejectedValue(
          new ErrorConectorInstitucional(MENSAJES_TABLA_2.sinConexion),
        ),
    )
      .ejecutarSincronizacion(`Bearer ${SECRETO}`)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).toBe(MENSAJES_TABLA_2.sinConexion);
  });

  it('secretosIguales compara el contenido completo', () => {
    expect(secretosIguales(SECRETO, SECRETO)).toBe(true);
    expect(secretosIguales(`${SECRETO}x`, SECRETO)).toBe(false);
    expect(secretosIguales('', SECRETO)).toBe(false);
  });
});
