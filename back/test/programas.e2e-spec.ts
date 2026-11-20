import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import { Programa } from '../src/dominio/entidades/programa';
import { Psicologo } from '../src/dominio/entidades/psicologo';
import { AppModule } from '../src/app.module';
import { configurarAplicacion } from '../src/configurar-aplicacion';
import { validarEntorno } from '../src/validacion-entorno';
import { crearEscenario, crearRepositorios } from './integracion/escenario';
import {
  abrirFuenteAplicacion,
  BASE_PRUEBAS,
  migrarBasePruebas,
  vaciarBasePruebas,
} from './integracion/soporte';

let app: INestApplication;
let url: string;
let fuente: DataSource;
let tokenPsicologo: string;
let tokenJefe: string;

beforeAll(async () => {
  await migrarBasePruebas();
  await vaciarBasePruebas();
  fuente = await abrirFuenteAplicacion();

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService(
        validarEntorno({ ...process.env, BD_DETECTA_NOMBRE: BASE_PRUEBAS }),
      ),
    )
    .compile();
  app = modulo.createNestApplication({ logger: false });
  configurarAplicacion(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  const jwt = app.get(JwtService);
  tokenPsicologo = await jwt.signAsync({ sub: 'PS1', rol: 'PSICOLOGO' });
  tokenJefe = await jwt.signAsync({ sub: 'J1', rol: 'JEFE_DEPARTAMENTO' });
});

beforeEach(async () => {
  await vaciarBasePruebas();
  await crearEscenario(crearRepositorios(fuente));
});

afterAll(async () => {
  await app.close();
  await fuente.destroy();
});

describe('GET /programas (B10)', () => {
  it('responde 401 sin sesión', async () => {
    const respuesta = await fetch(`${url}/programas`);
    expect(respuesta.status).toBe(401);
  });

  it('responde 403 al Jefe de Departamento', async () => {
    const respuesta = await fetch(`${url}/programas`, {
      headers: { Cookie: `detecta_sesion=${tokenJefe}` },
    });
    expect(respuesta.status).toBe(403);
  });

  it('devuelve al Psicólogo solo id y nombre en orden español y sin caché', async () => {
    const repositorio = crearRepositorios(fuente).programas;
    await repositorio.guardar(
      new Programa({ idPrograma: 'P5', nombre: 'zoología' }),
    );
    await repositorio.guardar(
      new Programa({ idPrograma: 'P4', nombre: 'Psicología' }),
    );
    await repositorio.guardar(
      new Programa({ idPrograma: 'P3', nombre: 'asesoría' }),
    );
    await repositorio.guardar(
      new Programa({ idPrograma: 'P2', nombre: 'Álgebra' }),
    );
    await repositorio.guardar(
      new Programa({ idPrograma: 'P1', nombre: 'algebra' }),
    );

    const respuesta = await fetch(`${url}/programas`, {
      headers: { Cookie: `detecta_sesion=${tokenPsicologo}` },
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('cache-control')).toBe('no-store');
    expect(await respuesta.json()).toEqual([
      { idPrograma: 'P1', nombre: 'algebra' },
      { idPrograma: 'P2', nombre: 'Álgebra' },
      { idPrograma: 'P3', nombre: 'asesoría' },
      { idPrograma: 'P4', nombre: 'Psicología' },
      { idPrograma: 'P5', nombre: 'zoología' },
    ]);
  });

  it('devuelve 200 y [] al Psicólogo cuando no hay programas', async () => {
    await vaciarBasePruebas();
    const personas = crearRepositorios(fuente).personas;
    await personas.guardar(
      new Psicologo({
        id: 'PS1',
        nombre: 'Psicólogo Uno',
        correo: 'ps1@ejemplo.edu.co',
        contrasenaHash: 'x',
        citas: [],
      }),
    );

    const respuesta = await fetch(`${url}/programas`, {
      headers: { Cookie: `detecta_sesion=${tokenPsicologo}` },
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('cache-control')).toBe('no-store');
    await expect(respuesta.json()).resolves.toEqual([]);
  });
});
