import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Aplicacion } from '../aplicacion';
import { renderizar, simularApi, sesionDe } from './utilidades';

const ID_CASO = 'caso-psicologico-secreto';
const RUTA = `/psicologo/casos/${ID_CASO}`;
const SESION = { estado: 200, cuerpo: sesionDe('PSICOLOGO') };

function renderizarAplicacion(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Aplicacion />
    </MemoryRouter>,
  );
}

function comprobarIdsOcultos(idsSecretos: readonly string[]) {
  const contieneIdVisible = idsSecretos.some((id) =>
    document.body.textContent?.includes(id),
  );
  const atributos = Array.from(document.body.querySelectorAll('*'))
    .flatMap((elemento) => Array.from(elemento.attributes))
    .filter(
      (atributo) =>
        atributo.name === 'id' ||
        atributo.name.startsWith('aria-') ||
        atributo.name.startsWith('data-'),
    );
  const contieneIdEnAtributo = atributos.some((atributo) =>
    idsSecretos.some((id) => atributo.value.includes(id)),
  );
  expect(contieneIdVisible).toBe(false);
  expect(contieneIdEnAtributo).toBe(false);
}

const DETALLE = {
  caso: {
    idCaso: ID_CASO,
    fechaCreacion: '2026-11-19T15:00:00.000Z',
    estado: 'PENDIENTE',
    ruta: 'PSICOLOGICA',
    nivelRiesgo: null,
    estudiante: { id: 'estudiante-secreto', nombre: 'Estudiante de prueba' },
    origen: {
      tipo: 'SOLICITUD',
      idOrigen: 'origen-secreto',
      fecha: '2026-11-19T15:00:00.000Z',
      tipoApoyo: 'PSICOLOGICA',
      motivo: 'Motivo confidencial de prueba',
      disponibilidad: 'En la tarde',
    },
    justificacion: '',
    consentimientoConfirmado: false,
    requiereConsentimiento: true,
    psicologo: null,
    presentaRiesgoCritico: false,
    citas: [
      {
        idCita: 'cita-secreto',
        fechaHora: '2026-11-20T15:00:00.000Z',
        modalidad: 'PRESENCIAL',
        estado: 'CERRADA',
        asesoria: {
          idAsesoria: 'asesoria-secreta',
          fecha: '2026-11-20T15:00:00.000Z',
          tipoAsesoria: 'ORIENTACION',
          observaciones: 'Observaciones confidenciales de prueba',
          acuerdos: 'Acuerdos confidenciales de prueba',
          asistencia: true,
          requiereSeguimiento: false,
          presentaRiesgoCritico: false,
        },
      },
    ],
  },
  antecedentes: [
    {
      idRegistro: 'registro-secreto',
      curso: {
        idCurso: 'curso-secreto',
        nombre: 'Cálculo I',
        periodo: '2026-2',
      },
      nota: 3.5,
      porcentajeAsistencia: 88,
      ultimaSincronizacion: null,
    },
  ],
};

describe('Consentimiento de menores (CUD09)', () => {
  it('bloquea registrar un resultado hasta que el DTO confirme consentimiento y no expone identificadores ni almacenamiento', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: {
        estado: 200,
        cuerpo: {
          ...DETALLE,
          caso: {
            ...DETALLE.caso,
            estado: 'CITADO',
            psicologo: { id: 'psicologo-secreto', nombre: 'Psicólogo' },
            citas: [{ ...DETALLE.caso.citas[0], asesoria: null }],
          },
        },
      },
    });
    renderizarAplicacion(RUTA);
    expect(
      await screen.findByText(
        'Confirme el consentimiento informado antes de registrar asesoría o resultado.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Registrar resultado' }),
    ).toBeDisabled();
    expect(llamadas.some((llamada) => llamada.url.includes('/resultado'))).toBe(
      false,
    );
    const identificadores = [
      ID_CASO,
      'estudiante-secreto',
      'origen-secreto',
      'cita-secreto',
      'asesoria-secreta',
      'registro-secreto',
      'curso-secreto',
      'psicologo-secreto',
    ];
    const atributos = Array.from(document.body.querySelectorAll('*')).flatMap(
      (elemento) => Array.from(elemento.attributes),
    );
    expect(
      identificadores.some((id) => document.body.textContent?.includes(id)),
    ).toBe(false);
    expect(
      atributos.some(
        (atributo) =>
          [
            'id',
            ...['aria-', 'data-'].flatMap((prefijo) => [
              atributo.name.startsWith(prefijo) ? atributo.name : '',
            ]),
          ].includes(atributo.name) &&
          identificadores.some((id) => atributo.value.includes(id)),
      ),
    ).toBe(false);
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  it('R06: no ofrece registrar el resultado de atención en F4a mientras el DTO exige consentimiento', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: { estado: 200, cuerpo: DETALLE },
    });
    renderizarAplicacion(RUTA);

    expect(
      await screen.findByRole('checkbox', {
        name: '¿El acudiente otorgó el consentimiento informado?',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Registrar resultado' }),
    ).toBeNull();
  });

  it('bloquea la confirmación hasta que el Psicólogo confirma el documento físico', async () => {
    let lecturas = 0;
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: () => {
        lecturas += 1;
        return {
          estado: 200,
          cuerpo:
            lecturas === 1
              ? DETALLE
              : {
                  ...DETALLE,
                  caso: {
                    ...DETALLE.caso,
                    consentimientoConfirmado: true,
                    requiereConsentimiento: false,
                  },
                },
        };
      },
      [`POST /atencion/casos/${ID_CASO}/consentimiento`]: {
        estado: 200,
        cuerpo: { consentimientoConfirmado: true },
      },
    });
    const usuario = userEvent.setup();
    renderizarAplicacion(RUTA);

    const pregunta = await screen.findByRole('checkbox', {
      name: '¿El acudiente otorgó el consentimiento informado?',
    });
    const boton = screen.getByRole('button', {
      name: 'Confirmar consentimiento',
    });
    expect(pregunta).not.toBeChecked();
    expect(boton).toBeDisabled();
    expect(
      llamadas.filter((llamada) => llamada.metodo === 'POST'),
    ).toHaveLength(0);

    await usuario.click(pregunta);
    expect(boton).toBeEnabled();
    await usuario.click(boton);

    expect(
      await screen.findByText('El consentimiento informado está confirmado.'),
    ).toBeInTheDocument();
    expect(llamadas.find((llamada) => llamada.metodo === 'POST')).toMatchObject(
      { cuerpo: undefined },
    );
  });
});

describe('Reintento de confirmación del consentimiento (CUD09)', () => {
  it('permite reintentar el POST sin cuerpo si se perdió la respuesta', async () => {
    let compromiso = false;
    let envios = 0;
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: () => ({
        estado: 200,
        cuerpo: compromiso
          ? {
              ...DETALLE,
              caso: {
                ...DETALLE.caso,
                consentimientoConfirmado: true,
                requiereConsentimiento: false,
              },
            }
          : DETALLE,
      }),
      [`POST /atencion/casos/${ID_CASO}/consentimiento`]: () => {
        envios += 1;
        compromiso = true;
        return envios === 1
          ? 'red'
          : {
              estado: 200,
              cuerpo: { consentimientoConfirmado: true },
            };
      },
    });
    const usuario = userEvent.setup();
    renderizarAplicacion(RUTA);
    await usuario.click(
      await screen.findByRole('checkbox', {
        name: '¿El acudiente otorgó el consentimiento informado?',
      }),
    );
    const boton = screen.getByRole('button', {
      name: 'Confirmar consentimiento',
    });
    await usuario.click(boton);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(boton).toBeEnabled();
    await usuario.click(boton);
    expect(
      await screen.findByText('El consentimiento informado está confirmado.'),
    ).toBeInTheDocument();
    expect(
      llamadas.filter((llamada) => llamada.metodo === 'POST'),
    ).toHaveLength(2);
    expect(
      llamadas
        .filter((llamada) => llamada.metodo === 'POST')
        .every((llamada) => llamada.cuerpo === undefined),
    ).toBe(true);
  });
});

describe('Bandeja de remisiones (CUD06)', () => {
  it('separa sin asignar y asignadas; un caso aprobado permanece asignado', async () => {
    const asignado = {
      ...DETALLE.caso,
      estado: 'EN_EVALUACION',
      consentimientoConfirmado: true,
      requiereConsentimiento: false,
      psicologo: { id: 'psicologo-secreto', nombre: 'Psicóloga de prueba' },
    };
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /atencion/casos': {
        estado: 200,
        cuerpo: [DETALLE.caso, asignado],
      },
    });
    renderizar('/psicologo');

    expect(
      await screen.findByRole('heading', { name: 'Sin asignar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Asignadas a mí' }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Ver expediente' });
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveAttribute('href', RUTA);
    expect(screen.getByText('En evaluación')).toBeInTheDocument();
  });

  it('el psicólogo ve el texto de error al consultar la bandeja', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /atencion/casos': {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
    });
    renderizar('/psicologo');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error al consultar la información',
    );
  });
});

describe('Expediente del Psicólogo (CUD06)', () => {
  it('muestra campos del DTO sin incluir identificadores ni escribir en almacenamiento', async () => {
    const escribir = vi.spyOn(Storage.prototype, 'setItem');
    localStorage.clear();
    sessionStorage.clear();
    simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: { estado: 200, cuerpo: DETALLE },
    });
    renderizarAplicacion(RUTA);

    expect(
      await screen.findByText('Motivo confidencial de prueba'),
    ).toBeInTheDocument();
    expect(screen.getByText('En la tarde')).toBeInTheDocument();
    expect(
      screen.getByText('Observaciones confidenciales de prueba'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/menor de edad/i)).toBeNull();
    const idsSecretos = [
      ID_CASO,
      'estudiante-secreto',
      'origen-secreto',
      'registro-secreto',
      'curso-secreto',
      'cita-secreto',
      'asesoria-secreta',
    ];
    comprobarIdsOcultos(idsSecretos);
    expect(escribir).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('401 en el expediente: regresa al inicio de sesión con el aviso', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: {
        estado: 401,
        cuerpo: { message: 'Sesión no válida o caducada' },
      },
    });
    renderizar(RUTA);
    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );
  });

  it('403: muestra el texto genérico de F0', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: {
        estado: 403,
        cuerpo: { statusCode: 403, message: 'Forbidden resource' },
      },
    });
    renderizar(RUTA);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tiene permiso para realizar esta acción.',
    );
  });
});

describe('Evaluación de pertinencia (CUD07)', () => {
  it('no elige una decisión por defecto y valida la justificación antes de enviar', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: { estado: 200, cuerpo: DETALLE },
      [`POST /pertinencia/${ID_CASO}`]: {
        estado: 200,
        cuerpo: {
          mensaje: 'Caso aprobado. Programe la cita',
          estado: 'EN_EVALUACION',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(RUTA);
    const enviar = await screen.findByRole('button', {
      name: 'Evaluar pertinencia',
    });
    expect(
      screen
        .getAllByRole('radio')
        .every((opcion) => !(opcion as HTMLInputElement).checked),
    ).toBe(true);
    expect(enviar).toBeDisabled();

    await usuario.click(screen.getByLabelText('Archivar'));
    await usuario.click(enviar);
    expect(
      await screen.findByText('Registre la justificación'),
    ).toBeInTheDocument();
    expect(
      llamadas.filter((llamada) => llamada.metodo === 'POST'),
    ).toHaveLength(0);
  });

  it('409: muestra el texto exacto del backend y conserva el formulario', async () => {
    const mensaje = 'El caso ya fue evaluado.';
    simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: { estado: 200, cuerpo: DETALLE },
      [`POST /pertinencia/${ID_CASO}`]: {
        estado: 409,
        cuerpo: { message: mensaje },
      },
    });
    const usuario = userEvent.setup();
    renderizar(RUTA);
    await usuario.click(await screen.findByLabelText('Archivar'));
    await usuario.type(
      screen.getByLabelText('Justificación'),
      'No corresponde',
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Evaluar pertinencia' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.getByLabelText('Justificación')).toHaveValue(
      'No corresponde',
    );
  });
});

describe('Límites y desenlaces de pertinencia', () => {
  it('429: muestra el mensaje y deshabilita el envío durante Retry-After', async () => {
    const mensaje = 'Demasiados intentos. Intente de nuevo más tarde.';
    simularApi({
      'GET /acceso/sesion': SESION,
      [`GET /atencion/casos/${ID_CASO}`]: { estado: 200, cuerpo: DETALLE },
      [`POST /pertinencia/${ID_CASO}`]: {
        estado: 429,
        cuerpo: { message: mensaje },
        cabeceras: { 'Retry-After': '2' },
      },
    });
    const usuario = userEvent.setup();
    renderizar(RUTA);
    await usuario.click(await screen.findByLabelText('Archivar'));
    await usuario.type(
      screen.getByLabelText('Justificación'),
      'No corresponde',
    );
    const enviar = screen.getByRole('button', { name: 'Evaluar pertinencia' });
    await usuario.click(enviar);
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(enviar).toBeDisabled();
  });

  it.each([
    ['ARCHIVAR', 'ARCHIVADO', 'Caso archivado'],
    ['REORIENTAR', 'REORIENTADO', 'Caso reorientado'],
  ] as const)(
    '%s muestra el texto provisional según el estado conciliado',
    async (accion, estado, mensaje) => {
      let lecturas = 0;
      const detallePosterior = {
        ...DETALLE,
        caso: { ...DETALLE.caso, estado, justificacion: 'Dictamen de prueba' },
      };
      const { llamadas } = simularApi({
        'GET /acceso/sesion': SESION,
        [`GET /atencion/casos/${ID_CASO}`]: () => {
          lecturas += 1;
          return {
            estado: 200,
            cuerpo: lecturas >= 3 ? detallePosterior : DETALLE,
          };
        },
        [`POST /pertinencia/${ID_CASO}`]: {
          estado: 200,
          cuerpo: { mensaje: 'Caso archivado / reorientado', estado },
        },
      });
      const usuario = userEvent.setup();
      renderizar(RUTA);
      await usuario.click(
        await screen.findByLabelText(
          accion === 'ARCHIVAR' ? 'Archivar' : 'Reorientar',
        ),
      );
      await usuario.type(
        screen.getByLabelText('Justificación'),
        'Dictamen de prueba',
      );
      await usuario.click(
        screen.getByRole('button', { name: 'Evaluar pertinencia' }),
      );
      expect(await screen.findByRole('status')).toHaveTextContent(mensaje);
      expect(
        llamadas.filter((llamada) => llamada.metodo === 'POST'),
      ).toHaveLength(1);
    },
  );
});

describe('Conciliación de aprobación', () => {
  it('tras fallo de red concilia la aprobación y permite continuar desde asignadas a mí', async () => {
    let lecturasDetalle = 0;
    let lecturasBandeja = 0;
    const asignado = {
      ...DETALLE.caso,
      estado: 'EN_EVALUACION',
      psicologo: { id: 'psicologo-secreto', nombre: 'Psicóloga de prueba' },
    };
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      'GET /atencion/casos': () => {
        lecturasBandeja += 1;
        return {
          estado: 200,
          cuerpo: lecturasBandeja === 1 ? [DETALLE.caso] : [asignado],
        };
      },
      [`GET /atencion/casos/${ID_CASO}`]: () => {
        lecturasDetalle += 1;
        return {
          estado: 200,
          cuerpo:
            lecturasDetalle >= 3 ? { ...DETALLE, caso: asignado } : DETALLE,
        };
      },
      [`POST /pertinencia/${ID_CASO}`]: 'red',
    });
    const usuario = userEvent.setup();
    renderizar('/psicologo');
    await usuario.click(
      await screen.findByRole('link', { name: 'Ver expediente' }),
    );
    await usuario.click(await screen.findByLabelText('Aprobar'));
    await usuario.type(
      screen.getByLabelText('Justificación'),
      'Dictamen aprobado',
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Evaluar pertinencia' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Caso aprobado. Programe la cita',
    );
    await usuario.click(
      screen.getAllByRole('link', { name: 'Remisiones' })[0]!,
    );
    expect(
      await screen.findByRole('heading', { name: 'Asignadas a mí' }),
    ).toBeInTheDocument();
    expect(screen.getByText('En evaluación')).toBeInTheDocument();
    expect(
      llamadas.filter((llamada) => llamada.metodo === 'POST'),
    ).toHaveLength(1);
  });
});
