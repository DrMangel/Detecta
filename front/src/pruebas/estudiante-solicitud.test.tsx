import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  TEXTO_ERROR_GENERICO,
  TEXTO_ERROR_RED,
  TEXTO_SIN_PERMISO,
} from '../servicios-api/errores';
import {
  renderizar,
  SIN_SESION,
  sesionDe,
  simularApi,
  type LlamadaRegistrada,
  type RespuestaSimulada,
} from './utilidades';

/*
 * Criterio de cierre de F1, «el estudiante radica una solicitud y obtiene
 * su código» (CUD02; R02; sd_CUD02): tipo de apoyo sin valor por defecto,
 * aviso de quién la verá antes del envío (R02 paso 3), motivo obligatorio
 * (5.a), comprobante con el código y sin identidad (ER 3.3.3), datos
 * conservados ante un 503 (6.a), doble envío (sección i, ajuste C), 403 de
 * matrícula (D21, respuesta 4) y nada en el almacenamiento del navegador.
 */

const SESION = { estado: 200, cuerpo: sesionDe('ESTUDIANTE') };
const SOLICITUDES = 'GET /consulta/solicitudes';
const RADICAR = 'POST /solicitudes';

const MOTIVO = 'Me está costando seguir el ritmo de Cálculo I.';
const DISPONIBILIDAD = 'Martes y jueves en la tarde';

function comprobante(
  codigo: string,
  datos: Partial<{
    tipoApoyo: string;
    motivo: string;
    disponibilidad: string;
  }> = {},
) {
  return {
    codigo,
    fecha: '2026-11-19T15:00:00.000Z',
    tipoApoyo: 'ACADEMICA',
    motivo: MOTIVO,
    disponibilidad: DISPONIBILIDAD,
    estado: 'PENDIENTE',
    ...datos,
  };
}

const LISTA_VACIA: RespuestaSimulada = { estado: 200, cuerpo: [] };
const CREADA: RespuestaSimulada = {
  estado: 201,
  cuerpo: comprobante('9f1c2d3e-0000-4000-8000-000000000001'),
};

async function diligenciar(
  tipo: 'Académico' | 'Psicosocial' = 'Académico',
  motivo = MOTIVO,
  disponibilidad = DISPONIBILIDAD,
) {
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole('radio', { name: tipo }));
  if (motivo !== '') {
    await usuario.type(screen.getByLabelText('Motivo'), motivo);
  }
  if (disponibilidad !== '') {
    await usuario.type(
      screen.getByLabelText('Disponibilidad horaria (opcional)'),
      disponibilidad,
    );
  }
  return usuario;
}

function botonEnviar() {
  return screen.getByRole('button', { name: 'Enviar solicitud' });
}

function envios(llamadas: LlamadaRegistrada[]) {
  return llamadas.filter(
    (l) => l.metodo === 'POST' && l.url === '/api/solicitudes',
  );
}

describe('Formulario de solicitud (CUD02 pasos 2 a 4)', () => {
  it('sin tipo de apoyo no se puede enviar y no hay aviso; el carácter de asesoría educativa está a la vista (ER 1.3.4)', async () => {
    simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/estudiante/solicitudes/nueva');
    expect(
      await screen.findByRole('heading', { name: 'Solicitar acompañamiento' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Académico' })).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Psicosocial' }),
    ).not.toBeChecked();
    expect(botonEnviar()).toBeDisabled();
    expect(screen.queryByText(/Podrá ver su solicitud/)).toBeNull();
    expect(
      screen.getByText(
        'El acompañamiento de DETECTA es una asesoría educativa y no una intervención clínica.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Disponibilidad horaria (opcional)'),
    ).not.toBeRequired();
  });

  it('el aviso de R02 cambia según el tipo, antes del envío', async () => {
    simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = userEvent.setup();

    await usuario.click(
      await screen.findByRole('radio', { name: 'Académico' }),
    );
    expect(
      screen.getByText(
        'Podrá ver su solicitud el Jefe de Departamento de Programa.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Si lo considera necesario, podrá remitirla a psicología; en ese caso dejará de verla y la verá el Psicólogo.',
      ),
    ).toBeInTheDocument();
    expect(botonEnviar()).toBeEnabled();

    await usuario.click(screen.getByRole('radio', { name: 'Psicosocial' }));
    expect(
      screen.getByText('Podrá ver su solicitud el Psicólogo.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/remitirla a psicología/)).toBeNull();
    expect(screen.queryByText(/Jefe de Departamento/)).toBeNull();
  });

  it('motivo vacío o solo espacios (5.a): el texto de sd_CUD02 junto al campo y no se envía', async () => {
    const { llamadas } = simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar('Psicosocial', '', '');
    await usuario.type(screen.getByLabelText('Motivo'), '   ');
    await usuario.click(botonEnviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Describa el motivo de la solicitud',
    );
    expect(screen.getByLabelText('Motivo')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Motivo')).toHaveAccessibleDescription(
      'Describa el motivo de la solicitud',
    );
    expect(llamadas.some((l) => l.url.includes('solicitudes'))).toBe(false);
  });

  it('límites del backend en los campos: motivo 2000 y disponibilidad 500; sin autocompletado', async () => {
    simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/estudiante/solicitudes/nueva');
    const motivo = await screen.findByLabelText('Motivo');
    const disponibilidad = screen.getByLabelText(
      'Disponibilidad horaria (opcional)',
    );
    expect(motivo).toHaveAttribute('maxLength', '2000');
    expect(disponibilidad).toHaveAttribute('maxLength', '500');
    expect(motivo).toHaveAttribute('autocomplete', 'off');
    expect(disponibilidad).toHaveAttribute('autocomplete', 'off');
  });
});

describe('Comprobante (CUD02 pasos 6 y 7; ER 3.3.3)', () => {
  it('201: el comprobante con código de rastreo, fecha y «Pendiente», sin datos de identidad', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: CREADA,
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Su solicitud fue recibida.',
    );
    const contenido = within(screen.getByRole('main'));
    expect(
      contenido.getByText('9f1c2d3e-0000-4000-8000-000000000001'),
    ).toBeInTheDocument();
    expect(contenido.getByText('Código de rastreo')).toBeInTheDocument();
    expect(contenido.getByText('19/11/2026')).toBeInTheDocument();
    expect(contenido.getByText('Pendiente')).toBeInTheDocument();
    // Sin identidad: ni nombre ni correo del estudiante en el comprobante.
    const texto = screen.getByRole('main').textContent ?? '';
    expect(texto).not.toContain('Usuario ESTUDIANTE');
    expect(texto).not.toContain('estudiante@ejemplo.edu.co');
    // El formulario ya no está: no hay segundo envío desde aquí.
    expect(
      screen.queryByRole('button', { name: 'Enviar solicitud' }),
    ).toBeNull();

    expect(envios(llamadas)).toHaveLength(1);
    expect(envios(llamadas)[0]).toMatchObject({
      cuerpo: {
        tipoApoyo: 'ACADEMICA',
        motivo: MOTIVO,
        disponibilidad: DISPONIBILIDAD,
      },
    });
  });

  it('tras el comprobante, el enlace «Solicitar acompañamiento» abre un formulario nuevo y vacío', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: CREADA,
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    await screen.findByText('Su solicitud fue recibida.');

    await usuario.click(
      within(screen.getByRole('navigation')).getByRole('link', {
        name: 'Solicitar acompañamiento',
      }),
    );
    expect(await screen.findByLabelText('Motivo')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Académico' })).not.toBeChecked();
  });
});

describe('Doble envío (sección i y ajuste C)', () => {
  it('el botón queda deshabilitado mientras se envía; un segundo clic no envía otra vez', async () => {
    let responder: (r: RespuestaSimulada) => void = () => undefined;
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: () =>
        new Promise<RespuestaSimulada>((resolver) => {
          responder = resolver;
        }),
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    await waitFor(() => expect(envios(llamadas)).toHaveLength(1));
    expect(botonEnviar()).toBeDisabled();
    await usuario.click(botonEnviar());
    responder(CREADA as RespuestaSimulada);
    expect(
      await screen.findByText('Su solicitud fue recibida.'),
    ).toBeInTheDocument();
    expect(envios(llamadas)).toHaveLength(1);
  });

  it('error de red y la solicitud sí quedó registrada: se muestra su comprobante sin reenviar', async () => {
    let consultas = 0;
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: () => {
        consultas += 1;
        return consultas === 1
          ? {
              estado: 200,
              cuerpo: [comprobante('anterior', { motivo: 'Otra' })],
            }
          : {
              estado: 200,
              cuerpo: [
                comprobante('nueva-registrada'),
                comprobante('anterior', { motivo: 'Otra' }),
              ],
            };
      },
      [RADICAR]: 'red',
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());

    expect(
      await screen.findByText('Su solicitud fue recibida.'),
    ).toBeInTheDocument();
    expect(screen.getByText('nueva-registrada')).toBeInTheDocument();
    expect(envios(llamadas)).toHaveLength(1);
    expect(consultas).toBe(2);
  });

  it('error de red y no quedó registrada: el error de red de F0 y lo escrito se conserva para reintentar', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      // Una idéntica ya existía antes: no cuenta como registrada ahora.
      [SOLICITUDES]: { estado: 200, cuerpo: [comprobante('anterior')] },
      [RADICAR]: 'red',
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_ERROR_RED);
    expect(screen.getByLabelText('Motivo')).toHaveValue(MOTIVO);
    expect(
      screen.getByLabelText('Disponibilidad horaria (opcional)'),
    ).toHaveValue(DISPONIBILIDAD);
    expect(screen.getByRole('radio', { name: 'Académico' })).toBeChecked();
    expect(botonEnviar()).toBeEnabled();
  });

  it('la consulta previa falla: no bloquea el envío (ajuste C)', async () => {
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: {
        estado: 503,
        cuerpo: { message: 'Error al consultar la información' },
      },
      [RADICAR]: CREADA,
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    expect(
      await screen.findByText('Su solicitud fue recibida.'),
    ).toBeInTheDocument();
    expect(envios(llamadas)).toHaveLength(1);
  });

  it('la consulta previa falla y luego hay error de red: el texto de resultado incierto (ajuste C)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: 'red',
      [RADICAR]: 'red',
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo confirmar si su solicitud fue registrada. Revise «Mis solicitudes» antes de enviarla de nuevo.',
    );
    expect(screen.getByLabelText('Motivo')).toHaveValue(MOTIVO);
  });

  it('error de red y la verificación posterior también falla: el texto de resultado incierto', async () => {
    let consultas = 0;
    simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: () => {
        consultas += 1;
        return consultas === 1 ? LISTA_VACIA : 'red';
      },
      [RADICAR]: 'red',
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /^No se pudo confirmar si su solicitud fue registrada\./,
    );
    expect(screen.getByLabelText('Motivo')).toHaveValue(MOTIVO);
  });
});

describe('Errores al enviar (R02 6.a, D21 y uniformes de F0)', () => {
  it('503 (6.a): el texto de sd_CUD02, lo escrito se conserva y el reintento envía lo mismo', async () => {
    let intentos = 0;
    const { llamadas } = simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: () => {
        intentos += 1;
        return intentos === 1
          ? {
              estado: 503,
              cuerpo: {
                message:
                  'No fue posible registrar la solicitud. Intente de nuevo',
              },
            }
          : CREADA;
      },
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible registrar la solicitud. Intente de nuevo',
    );
    expect(screen.getByLabelText('Motivo')).toHaveValue(MOTIVO);
    expect(
      screen.getByLabelText('Disponibilidad horaria (opcional)'),
    ).toHaveValue(DISPONIBILIDAD);
    expect(screen.getByRole('radio', { name: 'Académico' })).toBeChecked();

    await usuario.click(botonEnviar());
    expect(
      await screen.findByText('Su solicitud fue recibida.'),
    ).toBeInTheDocument();
    const [primero, segundo] = envios(llamadas);
    expect(segundo?.cuerpo).toEqual(primero?.cuerpo);
  });

  it('403 de matrícula (D21): el texto del backend, solo en POST /solicitudes (respuesta 4)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: {
        estado: 403,
        cuerpo: {
          message: 'No se encontró una matrícula activa asociada a su cuenta.',
          error: 'Forbidden',
          statusCode: 403,
        },
      },
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se encontró una matrícula activa asociada a su cuenta.',
    );
  });

  it('otro 403 en POST /solicitudes (ForbiddenException sin texto): el texto de F0 (ajuste E)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: {
        estado: 403,
        cuerpo: { message: 'Forbidden', statusCode: 403 },
      },
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      TEXTO_SIN_PERMISO,
    );
  });

  it('500: el texto genérico de F0', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: {
        estado: 500,
        cuerpo: { statusCode: 500, message: 'Internal server error' },
      },
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      TEXTO_ERROR_GENERICO,
    );
  });

  it('429: el texto del backend y el botón deshabilitado (Retry-After)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: {
        estado: 429,
        cuerpo: { message: 'Demasiados intentos. Intente de nuevo más tarde.' },
        cabeceras: { 'Retry-After': '30' },
      },
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Intente de nuevo más tarde.',
    );
    expect(botonEnviar()).toBeDisabled();
  });

  it('401 al enviar: al inicio de sesión con el aviso; el borrador no se conserva (respuesta 5)', async () => {
    let sesionVigente = true;
    simularApi({
      'GET /acceso/sesion': () => (sesionVigente ? SESION : SIN_SESION),
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: () => {
        sesionVigente = false;
        return SIN_SESION;
      },
      'POST /acceso/iniciar-sesion': SESION,
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());

    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesión no válida o caducada',
    );

    // Vuelve a entrar: el formulario está vacío.
    await usuario.type(
      screen.getByLabelText('Correo electrónico'),
      'estudiante@ejemplo.edu.co',
    );
    await usuario.type(screen.getByLabelText('Contraseña'), 'x');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await usuario.click(
      await screen.findByRole('link', { name: 'Solicitar acompañamiento' }),
    );
    expect(await screen.findByLabelText('Motivo')).toHaveValue('');
  });
});

describe('Datos confidenciales en el navegador', () => {
  it('ni el borrador, ni el envío, ni el comprobante se guardan en localStorage o sessionStorage', async () => {
    const escribir = vi.spyOn(Storage.prototype, 'setItem');
    simularApi({
      'GET /acceso/sesion': SESION,
      [SOLICITUDES]: LISTA_VACIA,
      [RADICAR]: CREADA,
    });
    renderizar('/estudiante/solicitudes/nueva');
    const usuario = await diligenciar();
    await usuario.click(botonEnviar());
    await screen.findByText('Su solicitud fue recibida.');
    expect(escribir).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });
});
