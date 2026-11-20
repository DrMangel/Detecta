import { describe, expect, it } from 'vitest';
import { simularApi } from '../pruebas/utilidades';
import {
  confirmarConsentimiento,
  consultarCasoPsicologo,
  consultarCasosPsicologo,
  evaluarPertinencia,
} from './psicologo';

describe('contratos del Psicólogo', () => {
  it('consulta la bandeja y el expediente con credenciales del mismo sitio', async () => {
    const { llamadas } = simularApi({
      'GET /atencion/casos': { estado: 200, cuerpo: [] },
      'GET /atencion/casos/caso%2Funo': {
        estado: 200,
        cuerpo: { caso: {}, antecedentes: [] },
      },
    });

    await consultarCasosPsicologo();
    await consultarCasoPsicologo('caso/uno');

    expect(
      llamadas.map(({ metodo, url, credenciales }) => [
        metodo,
        url,
        credenciales,
      ]),
    ).toEqual([
      ['GET', '/api/atencion/casos', 'same-origin'],
      ['GET', '/api/atencion/casos/caso%2Funo', 'same-origin'],
    ]);
  });

  it('envía los tres dictámenes y conserva el cuerpo acordado', async () => {
    const { llamadas } = simularApi({
      'POST /pertinencia/caso-1': {
        estado: 200,
        cuerpo: {
          mensaje: 'Caso aprobado. Programe la cita',
          estado: 'EN_EVALUACION',
        },
      },
    });

    await evaluarPertinencia('caso-1', true, 'Evaluación pertinente');
    await evaluarPertinencia('caso-1', false, 'No procede', false);
    await evaluarPertinencia('caso-1', false, 'Corresponde a otra área', true);

    expect(llamadas.map(({ cuerpo }) => cuerpo)).toEqual([
      { pertinente: true, justificacion: 'Evaluación pertinente' },
      { pertinente: false, justificacion: 'No procede', reorientar: false },
      {
        pertinente: false,
        justificacion: 'Corresponde a otra área',
        reorientar: true,
      },
    ]);
  });

  it('confirma el consentimiento con POST sin cuerpo', async () => {
    const { llamadas } = simularApi({
      'POST /atencion/casos/caso-1/consentimiento': {
        estado: 200,
        cuerpo: { consentimientoConfirmado: true },
      },
    });

    await confirmarConsentimiento('caso-1');

    expect(llamadas[0]).toMatchObject({
      metodo: 'POST',
      url: '/api/atencion/casos/caso-1/consentimiento',
      cuerpo: undefined,
      credenciales: 'same-origin',
    });
  });
});
