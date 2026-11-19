import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Alerta } from '../../dominio/entidades/alerta';
import type { Curso } from '../../dominio/entidades/curso';
import { InformeRiesgo } from '../../dominio/entidades/informe-riesgo';
import type { Persona } from '../../dominio/entidades/persona';
import type { RepositorioAlerta } from '../../dominio/repositorios/repositorio-alerta';
import type { RepositorioCasoRiesgo } from '../../dominio/repositorios/repositorio-caso-riesgo';
import type { RepositorioInformeRiesgo } from '../../dominio/repositorios/repositorio-informe-riesgo';
import type { RepositorioPlanNivelacion } from '../../dominio/repositorios/repositorio-plan-nivelacion';
import {
  REPOSITORIO_ALERTA,
  REPOSITORIO_CASO_RIESGO,
  REPOSITORIO_INFORME_RIESGO,
  REPOSITORIO_PLAN_NIVELACION,
} from '../../dominio/repositorios/tokens';
import type { Archivo } from '../contratos/archivo';
import { generarPdf } from './pdf-minimo';
import { RELOJ, type Reloj } from './servicio-autenticacion';

/**
 * Qué cuenta cada total (ajuste G del plan de B8). El PDF y la respuesta
 * HTTP los muestran para que nadie confunda los conteos.
 */
export const DEFINICIONES_TOTALES = {
  totalAlertas:
    'Alertas: todas las alertas tempranas emitidas en la asignatura y el periodo sobre estudiantes del programa, en cualquier estado.',
  totalCasos:
    'Casos: solo los casos cerrados o archivados del periodo cuyo origen es una alerta de la asignatura (R07). No incluye casos en curso ni reorientados, ni solicitudes voluntarias, ni los casos de la ruta académica, que siguen en nivelación.',
  totalPlanes:
    'Planes de nivelación: todos los planes (activos o finalizados) que refuerzan la asignatura, de estudiantes del programa. Se cuentan aparte de los casos.',
} as const;

/** Nombre fijo del archivo exportado, sin datos personales (ajuste A). */
export const NOMBRE_ARCHIVO_INFORME = 'informe-riesgo.pdf';

/**
 * Servicio `GeneradorInformeRiesgo` (diagrama de clases v3; R07; sd_CUD10).
 *
 * `generar` sigue la secuencia (alertas por curso; casos y planes por
 * periodo y programa) y filtra en memoria por la asignatura (respuesta 5).
 * Si los tres totales son cero devuelve null ("sin datos", respuesta 8) y no
 * guarda nada. El informe solo contiene totales y el resumen de
 * `consolidar()`: sin nombres, motivos, identidades ni expedientes (ER 3.5.3,
 * D18; Manual CUD10).
 *
 * Diferencias con el diagrama: `generar` recibe además el autor (asociación
 * "genera", `guardarConAutor`) y devuelve null cuando no hay datos.
 */
@Injectable()
export class GeneradorInformeRiesgo {
  constructor(
    @Inject(REPOSITORIO_ALERTA)
    private readonly alertas: RepositorioAlerta,
    @Inject(REPOSITORIO_CASO_RIESGO)
    private readonly casos: RepositorioCasoRiesgo,
    @Inject(REPOSITORIO_PLAN_NIVELACION)
    private readonly planes: RepositorioPlanNivelacion,
    @Inject(REPOSITORIO_INFORME_RIESGO)
    private readonly informes: RepositorioInformeRiesgo,
    @Inject(RELOJ)
    private readonly reloj: Reloj,
  ) {}

  async generar(
    periodo: string,
    idPrograma: string,
    curso: Curso,
    autor: Persona,
  ): Promise<InformeRiesgo | null> {
    const alertas = await this.alertas.listarPorCurso(
      curso.idCurso,
      periodo,
      idPrograma,
    );
    const casos = (
      await this.casos.listarPorPeriodo(periodo, idPrograma)
    ).filter(
      (caso) =>
        caso.origen instanceof Alerta &&
        caso.origen.registro.curso.idCurso === curso.idCurso,
    );
    const planes = (
      await this.planes.listarPorPeriodo(periodo, idPrograma)
    ).filter((plan) =>
      plan.cursos.some((refuerzo) => refuerzo.idCurso === curso.idCurso),
    );
    if (alertas.length === 0 && casos.length === 0 && planes.length === 0) {
      return null;
    }
    const informe = new InformeRiesgo({
      idInforme: randomUUID(),
      fecha: this.reloj(),
      periodo,
      totalAlertas: 0,
      totalCasos: 0,
      totalPlanes: 0,
      resumen: '',
      curso,
      casos,
      planes,
      alertas,
    });
    informe.consolidar();
    await this.informes.guardarConAutor(informe, idPrograma, autor);
    return informe;
  }

  /** Archivo PDF del informe: solo datos agregados (ajustes A y G). */
  exportar(informe: InformeRiesgo): Archivo {
    const lineas = [
      'DETECTA - Informe de riesgo por asignatura',
      '',
      `Asignatura: ${informe.curso.nombre} (${informe.curso.idCurso})`,
      `Periodo: ${informe.periodo}`,
      `Fecha de generación: ${informe.fecha.toISOString().slice(0, 10)}`,
      '',
      `Total de alertas: ${informe.totalAlertas}`,
      `Total de casos cerrados o archivados: ${informe.totalCasos}`,
      `Total de planes de nivelación: ${informe.totalPlanes}`,
      '',
      `Resumen: ${informe.resumen}`,
      '',
      'Qué cuenta cada total:',
      `- ${DEFINICIONES_TOTALES.totalAlertas}`,
      `- ${DEFINICIONES_TOTALES.totalCasos}`,
      `- ${DEFINICIONES_TOTALES.totalPlanes}`,
      '',
      'Este informe solo contiene datos agregados: no incluye nombres, motivos ni contenido de los expedientes.',
    ];
    return {
      nombre: NOMBRE_ARCHIVO_INFORME,
      tipoContenido: 'application/pdf',
      contenido: generarPdf(lineas),
    };
  }
}
