import { In, type EntityManager } from 'typeorm';
import { Alerta } from '../../dominio/entidades/alerta';
import { Asesoria } from '../../dominio/entidades/asesoria';
import { CasoRiesgo } from '../../dominio/entidades/caso-riesgo';
import { Cita } from '../../dominio/entidades/cita';
import { Curso } from '../../dominio/entidades/curso';
import { Docente } from '../../dominio/entidades/docente';
import type { EstadoCaso } from '../../dominio/entidades/estado-caso';
import type { EstadoCita } from '../../dominio/entidades/estado-cita';
import type { EstadoOrigen } from '../../dominio/entidades/estado-origen';
import type { EstadoPlan } from '../../dominio/entidades/estado-plan';
import { Estudiante } from '../../dominio/entidades/estudiante';
import { InformeRiesgo } from '../../dominio/entidades/informe-riesgo';
import { JefeDepartamento } from '../../dominio/entidades/jefe-departamento';
import type { Modalidad } from '../../dominio/entidades/modalidad';
import type { NivelRiesgo } from '../../dominio/entidades/nivel-riesgo';
import type { OrigenRiesgo } from '../../dominio/entidades/origen-riesgo';
import type { Persona } from '../../dominio/entidades/persona';
import { PlanNivelacion } from '../../dominio/entidades/plan-nivelacion';
import { Programa } from '../../dominio/entidades/programa';
import { Psicologo } from '../../dominio/entidades/psicologo';
import { RegistroAcademico } from '../../dominio/entidades/registro-academico';
import type { RutaAtencion } from '../../dominio/entidades/ruta-atencion';
import { SolicitudAcompanamiento } from '../../dominio/entidades/solicitud-acompanamiento';
import type { TipoAsesoria } from '../../dominio/entidades/tipo-asesoria';
import {
  EsquemaAsesoria,
  EsquemaCasoRiesgo,
  EsquemaCita,
  EsquemaCurso,
  EsquemaInformeRiesgo,
  EsquemaInformeRiesgoCaso,
  EsquemaInformeRiesgoPlan,
  EsquemaPlanNivelacion,
  EsquemaPlanNivelacionCurso,
  EsquemaPrograma,
  EsquemaRegistroAcademico,
  ModeloAlerta,
  ModeloDocente,
  ModeloEstudiante,
  ModeloJefeDepartamento,
  ModeloOrigenRiesgo,
  ModeloPersona,
  ModeloPsicologo,
  ModeloSolicitud,
  type FilaAsesoria,
  type FilaCasoRiesgo,
  type FilaCita,
  type FilaCurso,
  type FilaInformeRiesgo,
  type FilaPlanNivelacion,
  type FilaPrograma,
  type FilaRegistroAcademico,
} from '../esquemas';
import { desdeTextoFecha } from './fechas';
import { verificarCoherenciaEstudianteOrigen } from './coherencia';

/**
 * Carga grafos completos de entidades de dominio desde la BD sin N+1
 * (condición de Ivan en el plan de B2).
 *
 * Los constructores del dominio exigen grafos completos (p. ej. una Alerta
 * necesita su Docente, que necesita sus cursos, que necesitan sus
 * estudiantes). El cargador trabaja por niveles: en cada vuelta lanza como
 * máximo UNA consulta por tipo de fila pendiente (`WHERE id IN (...)`), de modo
 * que el número de consultas depende de la profundidad del grafo y no de la
 * cantidad de filas. Un mapa de identidad garantiza que cada fila produzca un
 * solo objeto: p. ej. la misma `Cita` en `CasoRiesgo.citas` y en
 * `Psicologo.citas`.
 *
 * Cada instancia vale para una sola operación de lectura.
 */
/** Tipos de fila que el cargador consulta por lotes. */
type TipoPendiente =
  | 'programas'
  | 'personas'
  | 'cursos'
  | 'cursosDeDocentes'
  | 'registros'
  | 'registrosDeCursos'
  | 'origenes'
  | 'casos'
  | 'citasDeCasos'
  | 'citasDePsicologos'
  | 'asesoriasDeCitas'
  | 'planes'
  | 'cursosDePlanes'
  | 'informes'
  | 'relacionesDeInformes';

export class CargadorGrafo {
  // Filas cargadas, por clave primaria.
  readonly #programas = new Map<string, FilaPrograma>();
  readonly #personas = new Map<string, ModeloPersona>();
  readonly #cursos = new Map<string, FilaCurso>();
  readonly #registros = new Map<string, FilaRegistroAcademico>();
  readonly #origenes = new Map<string, ModeloOrigenRiesgo>();
  readonly #casos = new Map<string, FilaCasoRiesgo>();
  readonly #citas = new Map<string, FilaCita>();
  readonly #asesoriasPorCita = new Map<string, FilaAsesoria>();
  readonly #planes = new Map<string, FilaPlanNivelacion>();
  readonly #cursosPorPlan = new Map<string, string[]>();
  readonly #informes = new Map<string, FilaInformeRiesgo>();
  readonly #casosPorInforme = new Map<string, string[]>();
  readonly #planesPorInforme = new Map<string, string[]>();

  // Pendientes por tipo: claves aún no consultadas.
  readonly #pendientes: Record<TipoPendiente, Set<string>> = {
    programas: new Set<string>(),
    personas: new Set<string>(),
    cursos: new Set<string>(),
    cursosDeDocentes: new Set<string>(),
    registros: new Set<string>(),
    registrosDeCursos: new Set<string>(),
    origenes: new Set<string>(),
    casos: new Set<string>(),
    citasDeCasos: new Set<string>(),
    citasDePsicologos: new Set<string>(),
    asesoriasDeCitas: new Set<string>(),
    planes: new Set<string>(),
    cursosDePlanes: new Set<string>(),
    informes: new Set<string>(),
    relacionesDeInformes: new Set<string>(),
  };
  // Claves ya consultadas (para no repetir consultas).
  readonly #consultados = new Map<string, Set<string>>();

  // Mapa de identidad de objetos de dominio ya construidos.
  readonly #objetos = new Map<string, unknown>();

  constructor(private readonly manager: EntityManager) {}

  // ---------------------------------------------------------------------
  // API pública: cargar por identificadores (conserva el orden de `ids`).
  // ---------------------------------------------------------------------

  async programas(ids: readonly string[]): Promise<Programa[]> {
    return this.#cargar('programas', ids, (id) => this.#programa(id));
  }

  async personas(ids: readonly string[]): Promise<Persona[]> {
    return this.#cargar('personas', ids, (id) => this.#persona(id));
  }

  async cursos(ids: readonly string[]): Promise<Curso[]> {
    return this.#cargar('cursos', ids, (id) => this.#curso(id));
  }

  async registros(ids: readonly string[]): Promise<RegistroAcademico[]> {
    return this.#cargar('registros', ids, (id) => this.#registro(id));
  }

  async origenes(ids: readonly string[]): Promise<OrigenRiesgo[]> {
    return this.#cargar('origenes', ids, (id) => this.#origen(id));
  }

  async casos(ids: readonly string[]): Promise<CasoRiesgo[]> {
    return this.#cargar('casos', ids, (id) => this.#caso(id));
  }

  async citas(ids: readonly string[]): Promise<Cita[]> {
    // Las citas se cargan por su clave; luego se resuelven sus asesorías.
    const faltantes = ids.filter((id) => !this.#citas.has(id));
    if (faltantes.length > 0) {
      const filas = await this.manager.find(EsquemaCita, {
        where: { idCita: In(faltantes) },
      });
      filas.forEach((fila) => this.#registrarCita(fila));
    }
    await this.#resolver();
    return ids.filter((id) => this.#citas.has(id)).map((id) => this.#cita(id));
  }

  async asesorias(ids: readonly string[]): Promise<Asesoria[]> {
    const filas = await this.manager.find(EsquemaAsesoria, {
      where: { idAsesoria: In([...ids]) },
    });
    filas.forEach((fila) => this.#asesoriasPorCita.set(fila.idCita, fila));
    const porId = new Map(filas.map((fila) => [fila.idAsesoria, fila]));
    return ids
      .map((id) => porId.get(id))
      .filter((fila): fila is FilaAsesoria => fila !== undefined)
      .map((fila) => this.#asesoria(fila));
  }

  async planes(ids: readonly string[]): Promise<PlanNivelacion[]> {
    return this.#cargar('planes', ids, (id) => this.#plan(id));
  }

  async informes(ids: readonly string[]): Promise<InformeRiesgo[]> {
    return this.#cargar('informes', ids, (id) => this.#informe(id));
  }

  // ---------------------------------------------------------------------
  // Resolución por niveles
  // ---------------------------------------------------------------------

  async #cargar<T>(
    tipo:
      | 'programas'
      | 'personas'
      | 'cursos'
      | 'registros'
      | 'origenes'
      | 'casos'
      | 'planes'
      | 'informes',
    ids: readonly string[],
    construir: (id: string) => T,
  ): Promise<T[]> {
    ids.forEach((id) => this.#pedir(tipo, id));
    await this.#resolver();
    const filas = this.#filasDe(tipo);
    return ids.filter((id) => filas.has(id)).map((id) => construir(id));
  }

  #filasDe(tipo: string): Map<string, unknown> {
    switch (tipo) {
      case 'programas':
        return this.#programas;
      case 'personas':
        return this.#personas;
      case 'cursos':
        return this.#cursos;
      case 'registros':
        return this.#registros;
      case 'origenes':
        return this.#origenes;
      case 'casos':
        return this.#casos;
      case 'planes':
        return this.#planes;
      default:
        return this.#informes;
    }
  }

  #pedir(tipo: TipoPendiente, clave: string): void {
    let consultados = this.#consultados.get(tipo);
    if (!consultados) {
      consultados = new Set<string>();
      this.#consultados.set(tipo, consultados);
    }
    if (!consultados.has(clave)) {
      this.#pendientes[tipo].add(clave);
    }
  }

  #tomar(tipo: TipoPendiente): string[] {
    const claves = [...this.#pendientes[tipo]];
    this.#pendientes[tipo].clear();
    const consultados = this.#consultados.get(tipo) ?? new Set<string>();
    claves.forEach((clave) => consultados.add(clave));
    this.#consultados.set(tipo, consultados);
    return claves;
  }

  #hayPendientes(): boolean {
    return Object.values(this.#pendientes).some(
      (conjunto) => conjunto.size > 0,
    );
  }

  async #resolver(): Promise<void> {
    while (this.#hayPendientes()) {
      const p = this.#pendientes;
      const consultas: (() => Promise<void>)[] = [];

      if (p.informes.size > 0) {
        const ids = this.#tomar('informes');
        consultas.push(() =>
          this.manager
            .find(EsquemaInformeRiesgo, { where: { idInforme: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => {
                this.#informes.set(fila.idInforme, fila);
                this.#pedir('cursos', fila.idCurso);
                this.#pedir('relacionesDeInformes', fila.idInforme);
              }),
            ),
        );
      }
      if (p.relacionesDeInformes.size > 0) {
        const ids = this.#tomar('relacionesDeInformes');
        ids.forEach((id) => {
          this.#casosPorInforme.set(id, []);
          this.#planesPorInforme.set(id, []);
        });
        consultas.push(
          () =>
            this.manager
              .find(EsquemaInformeRiesgoCaso, { where: { idInforme: In(ids) } })
              .then((filas) =>
                filas.forEach((fila) => {
                  this.#casosPorInforme.get(fila.idInforme)?.push(fila.idCaso);
                  this.#pedir('casos', fila.idCaso);
                }),
              ),
          () =>
            this.manager
              .find(EsquemaInformeRiesgoPlan, { where: { idInforme: In(ids) } })
              .then((filas) =>
                filas.forEach((fila) => {
                  this.#planesPorInforme.get(fila.idInforme)?.push(fila.idPlan);
                  this.#pedir('planes', fila.idPlan);
                }),
              ),
        );
      }
      if (p.planes.size > 0) {
        const ids = this.#tomar('planes');
        consultas.push(() =>
          this.manager
            .find(EsquemaPlanNivelacion, { where: { idPlan: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => {
                this.#planes.set(fila.idPlan, fila);
                this.#pedir('casos', fila.idCaso);
                this.#pedir('cursosDePlanes', fila.idPlan);
              }),
            ),
        );
      }
      if (p.cursosDePlanes.size > 0) {
        const ids = this.#tomar('cursosDePlanes');
        ids.forEach((id) => this.#cursosPorPlan.set(id, []));
        consultas.push(() =>
          this.manager
            .find(EsquemaPlanNivelacionCurso, { where: { idPlan: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => {
                this.#cursosPorPlan.get(fila.idPlan)?.push(fila.idCurso);
                this.#pedir('cursos', fila.idCurso);
              }),
            ),
        );
      }
      if (p.casos.size > 0) {
        const ids = this.#tomar('casos');
        consultas.push(() =>
          this.manager
            .find(EsquemaCasoRiesgo, { where: { idCaso: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => {
                this.#casos.set(fila.idCaso, fila);
                this.#pedir('personas', fila.idEstudiante);
                this.#pedir('origenes', fila.idOrigen);
                if (fila.idPsicologo) {
                  this.#pedir('personas', fila.idPsicologo);
                }
                this.#pedir('citasDeCasos', fila.idCaso);
              }),
            ),
        );
      }
      if (p.citasDeCasos.size > 0) {
        const ids = this.#tomar('citasDeCasos');
        consultas.push(() =>
          this.manager
            .find(EsquemaCita, { where: { idCaso: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => this.#registrarCita(fila)),
            ),
        );
      }
      if (p.citasDePsicologos.size > 0) {
        const ids = this.#tomar('citasDePsicologos');
        consultas.push(() =>
          this.manager
            .find(EsquemaCita, { where: { idPsicologo: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => this.#registrarCita(fila)),
            ),
        );
      }
      if (p.asesoriasDeCitas.size > 0) {
        const ids = this.#tomar('asesoriasDeCitas');
        consultas.push(() =>
          this.manager
            .find(EsquemaAsesoria, { where: { idCita: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) =>
                this.#asesoriasPorCita.set(fila.idCita, fila),
              ),
            ),
        );
      }
      if (p.origenes.size > 0) {
        const ids = this.#tomar('origenes');
        consultas.push(() =>
          this.manager
            .find(ModeloOrigenRiesgo, { where: { idOrigen: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => {
                this.#origenes.set(fila.idOrigen, fila);
                if (fila instanceof ModeloAlerta) {
                  this.#pedir('personas', fila.idDocente);
                  this.#pedir('registros', fila.idRegistro);
                } else if (fila instanceof ModeloSolicitud) {
                  this.#pedir('personas', fila.idEstudiante);
                }
              }),
            ),
        );
      }
      if (p.registros.size > 0) {
        const ids = this.#tomar('registros');
        consultas.push(() =>
          this.manager
            .find(EsquemaRegistroAcademico, { where: { idRegistro: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => this.#registrarRegistro(fila)),
            ),
        );
      }
      if (p.registrosDeCursos.size > 0) {
        const ids = this.#tomar('registrosDeCursos');
        consultas.push(() =>
          this.manager
            .find(EsquemaRegistroAcademico, { where: { idCurso: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => this.#registrarRegistro(fila)),
            ),
        );
      }
      if (p.cursos.size > 0) {
        const ids = this.#tomar('cursos');
        consultas.push(() =>
          this.manager
            .find(EsquemaCurso, { where: { idCurso: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => this.#registrarCurso(fila)),
            ),
        );
      }
      if (p.cursosDeDocentes.size > 0) {
        const ids = this.#tomar('cursosDeDocentes');
        consultas.push(() =>
          this.manager
            .find(EsquemaCurso, { where: { idDocente: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => this.#registrarCurso(fila)),
            ),
        );
      }
      if (p.personas.size > 0) {
        const ids = this.#tomar('personas');
        consultas.push(() =>
          this.manager
            .find(ModeloPersona, { where: { id: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) => {
                this.#personas.set(fila.id, fila);
                if (fila instanceof ModeloEstudiante) {
                  this.#pedir('programas', fila.idPrograma);
                } else if (fila instanceof ModeloJefeDepartamento) {
                  this.#pedir('programas', fila.idProgramaDirigido);
                } else if (fila instanceof ModeloDocente) {
                  this.#pedir('cursosDeDocentes', fila.id);
                } else if (fila instanceof ModeloPsicologo) {
                  this.#pedir('citasDePsicologos', fila.id);
                }
              }),
            ),
        );
      }
      if (p.programas.size > 0) {
        const ids = this.#tomar('programas');
        consultas.push(() =>
          this.manager
            .find(EsquemaPrograma, { where: { idPrograma: In(ids) } })
            .then((filas) =>
              filas.forEach((fila) =>
                this.#programas.set(fila.idPrograma, fila),
              ),
            ),
        );
      }

      // Las consultas de un mismo nivel son independientes. Dentro de una
      // transacción hay UNA sola conexión: lanzarlas en paralelo solo las
      // encola en el cliente de pg, que lo desaprueba ("Calling
      // client.query() when the client is already executing a query",
      // pg@9 lo eliminará). Ahí se ejecutan en serie; fuera de una
      // transacción, cada consulta toma su propia conexión del pool (B9, R9).
      if (this.manager.queryRunner?.isTransactionActive) {
        for (const consulta of consultas) {
          await consulta();
        }
      } else {
        await Promise.all(consultas.map((consulta) => consulta()));
      }
    }
  }

  #registrarCita(fila: FilaCita): void {
    this.#citas.set(fila.idCita, fila);
    this.#pedir('asesoriasDeCitas', fila.idCita);
  }

  #registrarRegistro(fila: FilaRegistroAcademico): void {
    this.#registros.set(fila.idRegistro, fila);
    this.#pedir('personas', fila.idEstudiante);
    this.#pedir('cursos', fila.idCurso);
  }

  #registrarCurso(fila: FilaCurso): void {
    this.#cursos.set(fila.idCurso, fila);
    // Los estudiantes del curso salen de sus registros académicos.
    this.#pedir('registrosDeCursos', fila.idCurso);
  }

  // ---------------------------------------------------------------------
  // Construcción de objetos de dominio (memorizada)
  // ---------------------------------------------------------------------

  #memo<T>(clave: string, construir: () => T): T {
    if (this.#objetos.has(clave)) {
      return this.#objetos.get(clave) as T;
    }
    const objeto = construir();
    this.#objetos.set(clave, objeto);
    return objeto;
  }

  #exigir<T>(mapa: Map<string, T>, id: string, tipo: string): T {
    const fila = mapa.get(id);
    if (fila === undefined) {
      throw new Error(`No se encontró ${tipo} ${id} al reconstruir el grafo`);
    }
    return fila;
  }

  #programa(id: string): Programa {
    return this.#memo(`programa:${id}`, () => {
      const fila = this.#exigir(this.#programas, id, 'el programa');
      return new Programa({ idPrograma: fila.idPrograma, nombre: fila.nombre });
    });
  }

  #persona(id: string): Persona {
    return this.#memo(`persona:${id}`, (): Persona => {
      const fila = this.#exigir(this.#personas, id, 'la persona');
      const base = {
        id: fila.id,
        nombre: fila.nombre,
        correo: fila.correo,
        contrasenaHash: fila.contrasenaHash,
      };
      if (fila instanceof ModeloEstudiante) {
        return new Estudiante({
          ...base,
          fechaNacimiento: desdeTextoFecha(fila.fechaNacimiento),
          programa: this.#programa(fila.idPrograma),
        });
      }
      if (fila instanceof ModeloJefeDepartamento) {
        return new JefeDepartamento({
          ...base,
          programa: this.#programa(fila.idProgramaDirigido),
        });
      }
      if (fila instanceof ModeloDocente) {
        const cursos = [...this.#cursos.values()]
          .filter((curso) => curso.idDocente === fila.id)
          .map((curso) => this.#curso(curso.idCurso));
        return new Docente({ ...base, cursos });
      }
      if (fila instanceof ModeloPsicologo) {
        const citas = [...this.#citas.values()]
          .filter((cita) => cita.idPsicologo === fila.id)
          .sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime())
          .map((cita) => this.#cita(cita.idCita));
        return new Psicologo({ ...base, citas });
      }
      throw new Error(`Rol de persona desconocido para ${fila.id}`);
    });
  }

  #estudiante(id: string): Estudiante {
    const persona = this.#persona(id);
    if (!(persona instanceof Estudiante)) {
      throw new Error(`La persona ${id} no es un estudiante`);
    }
    return persona;
  }

  #curso(id: string): Curso {
    return this.#memo(`curso:${id}`, () => {
      const fila = this.#exigir(this.#cursos, id, 'el curso');
      const idsEstudiantes = [...this.#registros.values()]
        .filter((registro) => registro.idCurso === id)
        .map((registro) => registro.idEstudiante);
      return new Curso({
        idCurso: fila.idCurso,
        nombre: fila.nombre,
        periodo: fila.periodo,
        ultimaSincronizacion: fila.ultimaSincronizacion,
        estudiantes: idsEstudiantes.map((idEstudiante) =>
          this.#estudiante(idEstudiante),
        ),
      });
    });
  }

  #registro(id: string): RegistroAcademico {
    return this.#memo(`registro:${id}`, () => {
      const fila = this.#exigir(this.#registros, id, 'el registro académico');
      return new RegistroAcademico({
        idRegistro: fila.idRegistro,
        nota: Number(fila.nota),
        porcentajeAsistencia: Number(fila.porcentajeAsistencia),
        estudiante: this.#estudiante(fila.idEstudiante),
        curso: this.#curso(fila.idCurso),
      });
    });
  }

  #origen(id: string): OrigenRiesgo {
    return this.#memo(`origen:${id}`, (): OrigenRiesgo => {
      const fila = this.#exigir(this.#origenes, id, 'el origen de riesgo');
      const base = {
        idOrigen: fila.idOrigen,
        fecha: fila.fecha,
        estado: fila.estado as EstadoOrigen,
      };
      if (fila instanceof ModeloAlerta) {
        const docente = this.#persona(fila.idDocente);
        if (!(docente instanceof Docente)) {
          throw new Error(`La alerta ${id} no fue emitida por un docente`);
        }
        return new Alerta({
          ...base,
          nivelRiesgo: fila.nivelRiesgo as NivelRiesgo,
          descripcion: fila.descripcion,
          docente,
          registro: this.#registro(fila.idRegistro),
        });
      }
      if (fila instanceof ModeloSolicitud) {
        return new SolicitudAcompanamiento({
          ...base,
          tipoApoyo: fila.tipoApoyo as RutaAtencion,
          motivo: fila.motivo,
          disponibilidad: fila.disponibilidad,
          estudiante: this.#estudiante(fila.idEstudiante),
        });
      }
      throw new Error(`Tipo de origen desconocido para ${id}`);
    });
  }

  #asesoria(fila: FilaAsesoria): Asesoria {
    return this.#memo(`asesoria:${fila.idAsesoria}`, () => {
      return new Asesoria({
        idAsesoria: fila.idAsesoria,
        fecha: fila.fecha,
        tipoAsesoria: fila.tipoAsesoria as TipoAsesoria,
        observaciones: fila.observaciones,
        acuerdos: fila.acuerdos,
        asistencia: fila.asistencia,
        requiereSeguimiento: fila.requiereSeguimiento,
        presentaRiesgoCritico: fila.presentaRiesgoCritico,
      });
    });
  }

  #cita(id: string): Cita {
    return this.#memo(`cita:${id}`, () => {
      const fila = this.#exigir(this.#citas, id, 'la cita');
      const asesoria = this.#asesoriasPorCita.get(id);
      return new Cita({
        idCita: fila.idCita,
        fechaHora: fila.fechaHora,
        modalidad: fila.modalidad as Modalidad,
        estado: fila.estado as EstadoCita,
        asesoria: asesoria ? this.#asesoria(asesoria) : null,
      });
    });
  }

  #caso(id: string): CasoRiesgo {
    return this.#memo(`caso:${id}`, () => {
      const fila = this.#exigir(this.#casos, id, 'el caso de riesgo');
      const psicologo = fila.idPsicologo
        ? this.#persona(fila.idPsicologo)
        : null;
      if (psicologo !== null && !(psicologo instanceof Psicologo)) {
        throw new Error(
          `El caso ${id} referencia a una persona que no es psicólogo`,
        );
      }
      const citas = [...this.#citas.values()]
        .filter((cita) => cita.idCaso === id)
        .sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime())
        .map((cita) => this.#cita(cita.idCita));
      const caso = new CasoRiesgo({
        idCaso: fila.idCaso,
        fechaCreacion: fila.fechaCreacion,
        motivo: fila.motivo,
        nivelRiesgo: fila.nivelRiesgo as NivelRiesgo | null,
        ruta: fila.ruta as RutaAtencion | null,
        estado: fila.estado as EstadoCaso,
        justificacion: fila.justificacion,
        confidencialidad: fila.confidencialidad,
        consentimientoConfirmado: fila.consentimientoConfirmado,
        estudiante: this.#estudiante(fila.idEstudiante),
        origen: this.#origen(fila.idOrigen),
        psicologo,
        citas,
      });
      verificarCoherenciaEstudianteOrigen(caso);
      return caso;
    });
  }

  #plan(id: string): PlanNivelacion {
    return this.#memo(`plan:${id}`, () => {
      const fila = this.#exigir(this.#planes, id, 'el plan de nivelación');
      return new PlanNivelacion({
        idPlan: fila.idPlan,
        descripcion: fila.descripcion,
        fecha: fila.fecha,
        cronograma: fila.cronograma,
        tutorNombre: fila.tutorNombre,
        tutorCodigo: fila.tutorCodigo,
        estado: fila.estado as EstadoPlan,
        caso: this.#caso(fila.idCaso),
        cursos: (this.#cursosPorPlan.get(id) ?? []).map((idCurso) =>
          this.#curso(idCurso),
        ),
      });
    });
  }

  #informe(id: string): InformeRiesgo {
    return this.#memo(`informe:${id}`, () => {
      const fila = this.#exigir(this.#informes, id, 'el informe de riesgo');
      return new InformeRiesgo({
        idInforme: fila.idInforme,
        fecha: fila.fecha,
        periodo: fila.periodo,
        totalAlertas: fila.totalAlertas,
        totalCasos: fila.totalCasos,
        totalPlanes: fila.totalPlanes,
        resumen: fila.resumen,
        curso: this.#curso(fila.idCurso),
        casos: (this.#casosPorInforme.get(id) ?? []).map((idCaso) =>
          this.#caso(idCaso),
        ),
        planes: (this.#planesPorInforme.get(id) ?? []).map((idPlan) =>
          this.#plan(idPlan),
        ),
        // Las alertas no se persisten con el informe (plan de B1, sd_CUD10):
        // los totales ya consolidados vienen de la fila.
        alertas: [],
      });
    });
  }
}
