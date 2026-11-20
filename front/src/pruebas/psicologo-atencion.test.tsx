import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sesionDe, simularApi } from './utilidades';

const ID = 'caso-prueba-atencion';
type RespuestaApi = { estado: number; cuerpo?: unknown };
type SimulacionApi =
  | RespuestaApi
  | 'red'
  | ((cuerpo: unknown) => RespuestaApi | 'red' | Promise<RespuestaApi | 'red'>);
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

function api(extra: Record<string, SimulacionApi>) {
  return simularApi({
    'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('PSICOLOGO') },
    [`GET /atencion/casos/${ID}`]: { estado: 200, cuerpo: detalle },
    ...extra,
  });
}

function cuerpoRegistro(valor: unknown): Record<string, unknown> {
  return valor as Record<string, unknown>;
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
    await usuario.selectOptions(
      screen.getAllByLabelText('Modalidad').at(-1)!,
      'VIRTUAL',
    );
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

  it('programa, reprograma, registra todos los campos, sigue y cierra usando el DTO actualizado', async () => {
    const caso: { estado: string; citas: Array<Record<string, unknown>> } = {
      ...detalle.caso,
      citas: [],
    };
    const detalleActual = () => ({
      caso: { ...caso, citas: [...caso.citas] },
      antecedentes: [],
    });
    const { llamadas } = api({
      [`GET /atencion/casos/${ID}`]: () => ({
        estado: 200,
        cuerpo: detalleActual(),
      }),
      [`POST /pertinencia/${ID}/citas`]: (cuerpo) => {
        const campos = cuerpoRegistro(cuerpo);
        caso.estado = 'CITADO';
        caso.citas = [
          {
            idCita: 'cita-1',
            fechaHora: '2026-11-25T14:00:00.000Z',
            modalidad: campos['modalidad'],
            estado: 'PROGRAMADA',
            asesoria: null,
          },
        ];
        return { estado: 201, cuerpo: { cita: caso.citas[0] } };
      },
      'POST /atencion/citas/cita-1/reprogramacion': (cuerpo) => {
        const campos = cuerpoRegistro(cuerpo);
        caso.citas = [
          {
            ...caso.citas[0],
            fechaHora: '2026-11-26T15:00:00.000Z',
            modalidad: campos['modalidad'],
            estado: 'REPROGRAMADA',
          },
        ];
        return { estado: 200, cuerpo: { cita: caso.citas[0] } };
      },
      [`POST /atencion/casos/${ID}/citas/cita-1/resultado`]: (cuerpo) => {
        caso.citas = [
          {
            ...caso.citas[0],
            asesoria: {
              idAsesoria: 'asesoria-1',
              fecha: '2026-11-26T15:00:00.000Z',
              ...cuerpoRegistro(cuerpo),
            },
          },
        ];
        return {
          estado: 201,
          cuerpo: { mensaje: 'Resultado registrado', cita: caso.citas[0] },
        };
      },
      [`POST /atencion/casos/${ID}/seguimiento`]: (cuerpo) => {
        const campos = cuerpoRegistro(cuerpo);
        caso.estado = 'EN_SEGUIMIENTO';
        caso.citas = [
          ...caso.citas,
          {
            idCita: 'cita-2',
            fechaHora: '2026-11-29T15:00:00.000Z',
            modalidad: campos['modalidad'],
            estado: 'PROGRAMADA',
            asesoria: null,
          },
        ];
        return { estado: 201, cuerpo: { cita: caso.citas[1]! } };
      },
      [`POST /atencion/casos/${ID}/citas/cita-2/resultado`]: (cuerpo) => {
        caso.citas = [
          caso.citas[0]!,
          {
            ...caso.citas[1],
            asesoria: {
              idAsesoria: 'asesoria-2',
              fecha: '2026-11-29T15:00:00.000Z',
              ...cuerpoRegistro(cuerpo),
            },
          },
        ];
        return {
          estado: 201,
          cuerpo: { mensaje: 'Resultado registrado', cita: caso.citas[1]! },
        };
      },
      [`POST /atencion/casos/${ID}/cierre`]: () => {
        caso.estado = 'CERRADO';
        return { estado: 200, cuerpo: { mensaje: 'Caso cerrado' } };
      },
    });
    const usuario = userEvent.setup();
    renderizar(`/psicologo/casos/${ID}`);

    await usuario.type(
      await screen.findByLabelText('Fecha y hora (Bogotá)'),
      '2026-11-25T09:00',
    );
    await usuario.selectOptions(
      screen.getByLabelText('Modalidad'),
      'PRESENCIAL',
    );
    await usuario.click(screen.getByRole('button', { name: 'Programar cita' }));
    await screen.findByRole('heading', { name: /Cita:/ });

    const fechaReprogramada = screen.getByLabelText(
      'Nueva fecha y hora (Bogotá)',
    );
    await usuario.clear(fechaReprogramada);
    await usuario.type(fechaReprogramada, '2026-11-26T10:00');
    await usuario.selectOptions(screen.getByLabelText('Modalidad'), 'VIRTUAL');
    await usuario.click(screen.getByRole('button', { name: 'Reprogramar' }));
    await screen.findByRole('heading', { name: /Cita:/ });

    await usuario.type(
      screen.getByLabelText('Observaciones'),
      'Resultado de prueba',
    );
    await usuario.type(screen.getByLabelText('Acuerdos'), 'Acuerdos de prueba');
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'SEGUIMIENTO');
    await usuario.selectOptions(screen.getByLabelText('Asistencia'), 'false');
    await usuario.click(screen.getByLabelText('Requiere seguimiento'));
    await usuario.click(screen.getByLabelText('Presenta riesgo crítico'));
    await usuario.click(
      screen.getByRole('button', { name: 'Registrar resultado' }),
    );
    await screen.findByRole('heading', { name: 'Programar seguimiento' });
    expect(screen.getByRole('button', { name: 'Cerrar caso' })).toBeEnabled();

    const fechaSeguimiento = screen.getByLabelText('Fecha y hora (Bogotá)');
    await usuario.clear(fechaSeguimiento);
    await usuario.type(fechaSeguimiento, '2026-11-29T10:00');
    await usuario.selectOptions(
      screen.getAllByLabelText('Modalidad').at(-1)!,
      'VIRTUAL',
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Programar seguimiento' }),
    );
    expect(
      await screen.findAllByRole('heading', { name: /Cita:/ }),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Cerrar caso' })).toBeDisabled();
    await usuario.type(
      screen.getByLabelText('Observaciones'),
      'Resultado del seguimiento',
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Registrar resultado' }),
    );
    await waitForEnabledClose();
    await usuario.click(screen.getByRole('button', { name: 'Cerrar caso' }));
    expect(await screen.findByText('Caso cerrado')).toBeInTheDocument();

    expect(caso.estado).toBe('CERRADO');
    const writes = llamadas.filter((llamada) => llamada.metodo === 'POST');
    expect(writes.map((llamada) => llamada.url)).toEqual([
      `/api/pertinencia/${ID}/citas`,
      '/api/atencion/citas/cita-1/reprogramacion',
      `/api/atencion/casos/${ID}/citas/cita-1/resultado`,
      `/api/atencion/casos/${ID}/seguimiento`,
      `/api/atencion/casos/${ID}/citas/cita-2/resultado`,
      `/api/atencion/casos/${ID}/cierre`,
    ]);
    expect(writes[0]?.cuerpo).toEqual({
      fechaHora: '2026-11-25T09:00:00-05:00',
      modalidad: 'PRESENCIAL',
    });
    expect(writes[1]?.cuerpo).toEqual({
      fechaHora: '2026-11-26T10:00:00-05:00',
      modalidad: 'VIRTUAL',
    });
    expect(writes[2]?.cuerpo).toEqual({
      tipo: 'SEGUIMIENTO',
      observaciones: 'Resultado de prueba',
      acuerdos: 'Acuerdos de prueba',
      asistencia: false,
      requiereSeguimiento: true,
      presentaRiesgoCritico: true,
    });
    expect(writes[3]?.cuerpo).toEqual({
      fechaHora: '2026-11-29T10:00:00-05:00',
      modalidad: 'VIRTUAL',
    });
  });

  it.each([
    [
      'primera cita',
      'EN_EVALUACION',
      [],
      'Programar cita',
      `/pertinencia/${ID}/citas`,
    ],
    [
      'reprogramación',
      'CITADO',
      [
        {
          idCita: 'cita-1',
          fechaHora: '2026-11-25T14:00:00.000Z',
          modalidad: 'PRESENCIAL',
          estado: 'PROGRAMADA',
          asesoria: null,
        },
      ],
      'Reprogramar',
      '/atencion/citas/cita-1/reprogramacion',
    ],
    [
      'resultado',
      'CITADO',
      [
        {
          idCita: 'cita-1',
          fechaHora: '2026-11-25T14:00:00.000Z',
          modalidad: 'PRESENCIAL',
          estado: 'PROGRAMADA',
          asesoria: null,
        },
      ],
      'Registrar resultado',
      `/atencion/casos/${ID}/citas/cita-1/resultado`,
    ],
    [
      'seguimiento',
      'EN_SEGUIMIENTO',
      [
        {
          idCita: 'cita-1',
          fechaHora: '2026-11-25T14:00:00.000Z',
          modalidad: 'PRESENCIAL',
          estado: 'CERRADA',
          asesoria: { requiereSeguimiento: true, observaciones: 'Completa' },
        },
      ],
      'Programar seguimiento',
      `/atencion/casos/${ID}/seguimiento`,
    ],
    [
      'cierre',
      'CITADO',
      [
        {
          idCita: 'cita-1',
          fechaHora: '2026-11-25T14:00:00.000Z',
          modalidad: 'PRESENCIAL',
          estado: 'CERRADA',
          asesoria: { requiereSeguimiento: false, observaciones: 'Completa' },
        },
      ],
      'Cerrar caso',
      `/atencion/casos/${ID}/cierre`,
    ],
  ] as const)(
    'bloquea el reintento de %s tras fallo de red',
    async (_nombre, estado, citas, boton, ruta) => {
      const caso = { ...detalle.caso, estado, citas };
      const { llamadas } = api({
        [`GET /atencion/casos/${ID}`]: {
          estado: 200,
          cuerpo: { caso, antecedentes: [] },
        },
        [`POST ${ruta}`]: 'red',
      });
      const usuario = userEvent.setup();
      renderizar(`/psicologo/casos/${ID}`);
      if (
        boton === 'Programar cita' ||
        boton === 'Reprogramar' ||
        boton === 'Programar seguimiento'
      ) {
        const label =
          boton === 'Reprogramar'
            ? 'Nueva fecha y hora (Bogotá)'
            : 'Fecha y hora (Bogotá)';
        await usuario.type(
          await screen.findByLabelText(label),
          '2026-11-25T09:00',
        );
      }
      if (boton === 'Registrar resultado')
        await usuario.type(
          await screen.findByLabelText('Observaciones'),
          'Resultado de prueba',
        );
      await usuario.click(await screen.findByRole('button', { name: boton }));
      expect(
        await screen.findByText(
          'No se pudo confirmar la operación. Consulte de nuevo el expediente antes de reintentar.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: boton })).toBeDisabled();
      await usuario.click(screen.getByRole('button', { name: boton }));
      expect(
        llamadas.filter((llamada) => llamada.metodo === 'POST'),
      ).toHaveLength(1);
    },
  );

  it('muestra el texto del 409 R06 si el consentimiento cambia después de cargar el expediente', async () => {
    api({
      [`GET /atencion/casos/${ID}`]: {
        estado: 200,
        cuerpo: {
          caso: {
            ...detalle.caso,
            estado: 'CITADO',
            requiereConsentimiento: true,
            consentimientoConfirmado: true,
            citas: [
              {
                idCita: 'cita-1',
                fechaHora: '2026-11-25T14:00:00.000Z',
                modalidad: 'PRESENCIAL',
                estado: 'PROGRAMADA',
                asesoria: null,
              },
            ],
          },
          antecedentes: [],
        },
      },
      [`POST /atencion/casos/${ID}/citas/cita-1/resultado`]: {
        estado: 409,
        cuerpo: {
          statusCode: 409,
          message: 'No se puede registrar la atención sin consentimiento',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(`/psicologo/casos/${ID}`);
    await usuario.type(
      await screen.findByLabelText('Observaciones'),
      'Resultado de prueba',
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Registrar resultado' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se puede registrar la atención sin consentimiento',
    );
  });
});

async function waitForEnabledClose() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Cerrar caso' })).toBeEnabled(),
  );
}
