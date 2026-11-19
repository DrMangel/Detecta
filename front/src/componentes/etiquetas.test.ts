import { describe, expect, it } from 'vitest';
import {
  NOMBRE_ESTADO,
  NOMBRE_NIVEL_RIESGO,
  NOMBRE_TIPO_APOYO,
  TEXTO_INDIQUE_PERIODO,
  TEXTO_INFORMACION_NO_DISPONIBLE,
} from './etiquetas';

/* Etiquetas y textos que comparten los roles (transcritos o del backend). */
describe('etiquetas compartidas', () => {
  it('valores de los enumerados para mostrar', () => {
    expect(NOMBRE_TIPO_APOYO).toEqual({
      ACADEMICA: 'Académico',
      PSICOLOGICA: 'Psicosocial',
    });
    expect(NOMBRE_ESTADO).toEqual({
      PENDIENTE: 'Pendiente',
      ATENDIDA: 'Atendida',
    });
    expect(NOMBRE_NIVEL_RIESGO).toEqual({
      BAJO: 'Bajo',
      MEDIO: 'Medio',
      ALTO: 'Alto',
    });
  });

  it('textos transcritos y reutilizados del backend', () => {
    expect(TEXTO_INFORMACION_NO_DISPONIBLE).toBe('Información no disponible');
    expect(TEXTO_INDIQUE_PERIODO).toBe('Indique el periodo académico.');
  });
});
