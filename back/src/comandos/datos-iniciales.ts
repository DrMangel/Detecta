import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HASH_SIN_ACTIVAR } from '../aplicacion/servicios/hash-contrasenas';
import { ServicioAutenticacion } from '../aplicacion/servicios/servicio-autenticacion';
import { Docente } from '../dominio/entidades/docente';
import { JefeDepartamento } from '../dominio/entidades/jefe-departamento';
import type { Persona } from '../dominio/entidades/persona';
import { Programa } from '../dominio/entidades/programa';
import { Psicologo } from '../dominio/entidades/psicologo';
import { Rol } from '../dominio/entidades/rol';
import type { Repositorio } from '../dominio/repositorios/repositorio';
import type { RepositorioPersona } from '../dominio/repositorios/repositorio-persona';
import {
  REPOSITORIO_PERSONA,
  REPOSITORIO_PROGRAMA,
} from '../dominio/repositorios/tokens';

/*
 * Script de datos iniciales (Manual 4.1.1.8; línea base §4; respuesta 8 de
 * Ivan en el plan de B3). Se implementa por partes:
 * - B3: programas y usuarios que no llegan por sincronización (docente, jefe
 *   de departamento con el programa que dirige, psicólogo).
 * - B4: cursos y asignación docente–curso.
 *
 * Idempotente por correo: si la cuenta existe no la duplica ni la modifica
 * (no hay DELETE). Las cuentas nuevas quedan sin activar (D6) y el script
 * imprime UNA vez su enlace de activación en la salida estándar, nunca en
 * logs ni en archivos.
 *
 * Uso (desde back/, tras `npm run build`):
 *   npm run datos:iniciales -- <archivo.json>
 *   npm run datos:iniciales -- --enlace <correo>   (enlace nuevo para una cuenta existente)
 *
 * El archivo real contiene datos personales (Ley 1581): está en .gitignore.
 * Solo se versiona `datos-iniciales.ejemplo.json`, con datos ficticios.
 */

export interface ProgramaInicial {
  idPrograma: string;
  nombre: string;
}

export interface UsuarioInicial {
  rol: Rol.DOCENTE | Rol.JEFE_DEPARTAMENTO | Rol.PSICOLOGO;
  id: string;
  nombre: string;
  correo: string;
  /** Solo para JEFE_DEPARTAMENTO: programa que dirige (debe existir). */
  idPrograma?: string;
}

export interface DatosIniciales {
  programas: ProgramaInicial[];
  usuarios: UsuarioInicial[];
}

export interface DependenciasDatosIniciales {
  personas: RepositorioPersona;
  programas: Repositorio<Programa>;
  autenticacion: Pick<ServicioAutenticacion, 'emitirEnlaceActivacion'>;
  /** Salida estándar del operador. */
  imprimir: (linea: string) => void;
}

const ROLES_PERMITIDOS = new Set<string>([
  Rol.DOCENTE,
  Rol.JEFE_DEPARTAMENTO,
  Rol.PSICOLOGO,
]);
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(
  objeto: Record<string, unknown>,
  campo: string,
  minimo: number,
  maximo: number,
  donde: string,
  errores: string[],
): string {
  const valor = objeto[campo];
  if (
    typeof valor !== 'string' ||
    valor.trim().length < minimo ||
    valor.trim().length > maximo
  ) {
    errores.push(
      `${donde}: "${campo}" debe tener entre ${minimo} y ${maximo} caracteres`,
    );
    return '';
  }
  return valor.trim();
}

/** Valida la estructura del archivo; lanza un Error con todos los problemas. */
export function validarDatosIniciales(json: unknown): DatosIniciales {
  const errores: string[] = [];
  const raiz = (
    typeof json === 'object' && json !== null ? json : {}
  ) as Record<string, unknown>;
  const programasCrudos = Array.isArray(raiz['programas'])
    ? raiz['programas']
    : null;
  const usuariosCrudos = Array.isArray(raiz['usuarios'])
    ? raiz['usuarios']
    : null;
  if (!programasCrudos || !usuariosCrudos) {
    throw new Error(
      'El archivo debe tener las listas "programas" y "usuarios"',
    );
  }

  const programas = programasCrudos.map((crudo, i) => {
    const objeto = (crudo ?? {}) as Record<string, unknown>;
    const donde = `programas[${i}]`;
    return {
      idPrograma: texto(objeto, 'idPrograma', 1, 36, donde, errores),
      nombre: texto(objeto, 'nombre', 2, 150, donde, errores),
    };
  });

  const usuarios = usuariosCrudos.map((crudo, i): UsuarioInicial => {
    const objeto = (crudo ?? {}) as Record<string, unknown>;
    const donde = `usuarios[${i}]`;
    const rol = objeto['rol'];
    if (typeof rol !== 'string' || !ROLES_PERMITIDOS.has(rol)) {
      errores.push(
        `${donde}: "rol" debe ser DOCENTE, JEFE_DEPARTAMENTO o PSICOLOGO (los estudiantes llegan por sincronización)`,
      );
    }
    const correo = texto(objeto, 'correo', 3, 100, donde, errores);
    if (correo && !FORMATO_CORREO.test(correo)) {
      errores.push(`${donde}: "correo" no es un correo válido`);
    }
    const usuario: UsuarioInicial = {
      rol: rol as UsuarioInicial['rol'],
      id: texto(objeto, 'id', 1, 36, donde, errores),
      nombre: texto(objeto, 'nombre', 2, 150, donde, errores),
      correo,
    };
    if (rol === Rol.JEFE_DEPARTAMENTO) {
      usuario.idPrograma = texto(objeto, 'idPrograma', 1, 36, donde, errores);
    } else if (objeto['idPrograma'] !== undefined) {
      errores.push(`${donde}: "idPrograma" solo aplica al JEFE_DEPARTAMENTO`);
    }
    return usuario;
  });

  const correos = usuarios.map((usuario) => usuario.correo.toLowerCase());
  correos.forEach((correo, i) => {
    if (correo && correos.indexOf(correo) !== i) {
      errores.push(`usuarios[${i}]: correo repetido en el archivo`);
    }
  });

  if (errores.length > 0) {
    throw new Error(`Datos iniciales inválidos:\n- ${errores.join('\n- ')}`);
  }
  return { programas, usuarios };
}

/** Carga programas y usuarios; devuelve cuántos se crearon y omitieron. */
export async function cargarDatosIniciales(
  datos: DatosIniciales,
  dependencias: DependenciasDatosIniciales,
): Promise<{ creados: number; omitidos: number }> {
  const { personas, programas, autenticacion, imprimir } = dependencias;
  let creados = 0;
  let omitidos = 0;

  // Programas: idempotente por idPrograma, sin modificar los existentes.
  const programasPorId = new Map<string, Programa>();
  for (const dato of datos.programas) {
    const existente = await programas.buscarPorId(dato.idPrograma);
    if (existente) {
      programasPorId.set(existente.idPrograma, existente);
      imprimir(`Programa ${dato.idPrograma}: ya existe, sin cambios.`);
      continue;
    }
    const programa = new Programa(dato);
    await programas.guardar(programa);
    programasPorId.set(programa.idPrograma, programa);
    imprimir(`Programa ${dato.idPrograma}: creado.`);
  }

  for (const dato of datos.usuarios) {
    if (await personas.buscarPorCorreo(dato.correo)) {
      omitidos += 1;
      imprimir(`Cuenta ${dato.correo}: ya existe, sin cambios.`);
      continue;
    }
    if (await personas.buscarPorId(dato.id)) {
      throw new Error(
        `El id ${dato.id} ya pertenece a otra cuenta (correo distinto): revise el archivo`,
      );
    }
    const base = {
      id: dato.id,
      nombre: dato.nombre,
      correo: dato.correo,
      // Cuenta sin activar (D6): se activa con el enlace.
      contrasenaHash: HASH_SIN_ACTIVAR,
    };
    let persona: Persona;
    if (dato.rol === Rol.JEFE_DEPARTAMENTO) {
      const idPrograma = dato.idPrograma ?? '';
      const programa =
        programasPorId.get(idPrograma) ??
        (await programas.buscarPorId(idPrograma));
      if (!programa) {
        throw new Error(
          `El programa ${idPrograma} del jefe ${dato.correo} no existe`,
        );
      }
      if (await personas.buscarJefePorPrograma(idPrograma)) {
        throw new Error(
          `El programa ${idPrograma} ya tiene jefe (reasignación pendiente, D17)`,
        );
      }
      persona = new JefeDepartamento({ ...base, programa });
    } else if (dato.rol === Rol.DOCENTE) {
      // La asignación docente–curso se carga en B4.
      persona = new Docente({ ...base, cursos: [] });
    } else {
      persona = new Psicologo({ ...base, citas: [] });
    }
    await personas.guardar(persona);
    const enlace = await autenticacion.emitirEnlaceActivacion(persona);
    creados += 1;
    imprimir(
      `Cuenta ${dato.correo} (${dato.rol}) creada. Enlace de activación (una sola vez):`,
    );
    imprimir(`  ${enlace}`);
  }
  return { creados, omitidos };
}

/** Emite un enlace nuevo para una cuenta existente (respuesta 8d). */
export async function emitirEnlaceParaCorreo(
  correo: string,
  dependencias: DependenciasDatosIniciales,
): Promise<void> {
  const persona = await dependencias.personas.buscarPorCorreo(correo);
  if (!persona) {
    throw new Error(`No existe una cuenta con el correo ${correo}`);
  }
  const enlace =
    await dependencias.autenticacion.emitirEnlaceActivacion(persona);
  dependencias.imprimir(`Enlace de activación para ${correo} (una sola vez):`);
  dependencias.imprimir(`  ${enlace}`);
}

async function principal(argumentos: string[]): Promise<void> {
  const [primero, segundo] = argumentos;
  if (!primero || (primero === '--enlace' && !segundo)) {
    throw new Error(
      'Uso: datos:iniciales -- <archivo.json> | datos:iniciales -- --enlace <correo>',
    );
  }
  const datos =
    primero === '--enlace'
      ? null
      : validarDatosIniciales(JSON.parse(readFileSync(primero, 'utf8')));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const dependencias: DependenciasDatosIniciales = {
      personas: app.get<RepositorioPersona>(REPOSITORIO_PERSONA),
      programas: app.get<Repositorio<Programa>>(REPOSITORIO_PROGRAMA),
      autenticacion: app.get(ServicioAutenticacion),
      imprimir: (linea) => process.stdout.write(`${linea}\n`),
    };
    if (datos === null) {
      await emitirEnlaceParaCorreo(segundo ?? '', dependencias);
    } else {
      const { creados, omitidos } = await cargarDatosIniciales(
        datos,
        dependencias,
      );
      process.stdout.write(
        `Listo: ${creados} cuentas creadas, ${omitidos} sin cambios.\n`,
      );
    }
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  principal(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
