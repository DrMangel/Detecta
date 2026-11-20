import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sesionDe, simularApi } from './utilidades';

const ID = 'caso-prueba-atencion';
const detalle = {
  caso: {
    idCaso: ID,
    fechaCreacion: '2026-11-19T15:00:00.000Z',
    estado: 'EN_EVALUACION',
    ruta: 'PSICOLOGICA',
    nivelRiesgo: null,
    estudiante: { id: 'estudiante-prueba', nombre: 'Estudiante de prueba' },
    origen: {
      tipo: 'SOLICITUD',
      idOrigen: 'origen-prueba',
      fecha: '2026-11-19T15:00:00.000Z',
      tipoApoyo: 'PSICOLOGICA',
      motivo: 'Motivo de prueba',
      disponibilidad: '',
    },
    justificacion: 'Prueba manual F4a',
    consentimientoConfirmado: false,
    requiereConsentimiento: false,
    psicologo: { id: 'psicologo-prueba', nombre: 'Psicólogo de prueba' },
    presentaRiesgoCritico: false,
    citas: [],
  },
  antecedentes: [],
};

function api(extra: Record<string, unknown>) {
  return simularApi({
    'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('PSICOLOGO') },
    [`GET /atencion/casos/${ID}`]: { estado: 200, cuerpo: detalle },
    ...extra,
  });
}

describe('Atención psicológica (F4b)', () => {
  it('envía la primera cita con zona explícita UTC-5 de Bogotá', async () => {
    const { llamadas } = api({
      [`POST /pertinencia/${ID}/citas`]: {
        estado: 201,
        cuerpo: {
          cita: {
            idCita: 'cita-prueba',
            fechaHora: '2026-11-25T14:00:00.000Z',
            modalidad: 'VIRTUAL',
            estado: 'PROGRAMADA',
            asesoria: null,
          },
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(`/psicologo/casos/${ID}`);
    await usuario.type(
      await screen.findByLabelText('Fecha y hora (Bogotá)'),
      '2026-11-25T09:00',
    );
    await usuario.selectOptions(screen.getByLabelText('Modalidad'), 'VIRTUAL');
    await usuario.click(screen.getByRole('button', { name: 'Programar cita' }));
    expect(
      await screen.findByRole('heading', { name: /Atención y seguimiento/ }),
    ).toBeInTheDocument();
    expect(
      llamadas.find((llamada) =>
        llamada.url.endsWith(`/pertinencia/${ID}/citas`),
      )?.cuerpo,
    ).toEqual({
      fechaHora: '2026-11-25T09:00:00-05:00',
      modalidad: 'VIRTUAL',
    });
  });

  it('muestra literalmente el error del backend para una fecha pasada', async () => {
    api({
      [`POST /pertinencia/${ID}/citas`]: {
        estado: 400,
        cuerpo: {
          statusCode: 400,
          message: 'La fecha de la cita debe ser posterior a la actual.',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(`/psicologo/casos/${ID}`);
    await usuario.type(
      await screen.findByLabelText('Fecha y hora (Bogotá)'),
      '2026-11-15T09:00',
    );
    await usuario.click(screen.getByRole('button', { name: 'Programar cita' }));
    expect(
      await screen.findByText(
        'La fecha de la cita debe ser posterior a la actual.',
      ),
    ).toBeInTheDocument();
  });
});
