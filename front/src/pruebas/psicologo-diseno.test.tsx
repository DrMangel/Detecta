import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  renderizar,
  sesionDe,
  simularApi,
  type RespuestaSimulada,
} from './utilidades';

/*
 * Pantallas del Psicólogo con el diseño de F5b (D7a; especificación §7.5 y
 * §7.6; maquetas 09 a 11): remisiones con tabla compacta, insignias y fila
 * que se abre; expediente en tarjetas; resultado de asesoría; y la
 * confirmación de consentimiento en un <dialog> modal.
 */

const SESION = { estado: 200, cuerpo: sesionDe('PSICOLOGO') };
const ID = 'caso-p1';
const DETALLE_GET = `GET /atencion/casos/${ID}`;
const CONSENTIMIENTO = `POST /atencion/casos/${ID}/consentimiento`;
const RUTA = `/psicologo/casos/${ID}`;
const TRAZO_CHEVRON = 'm9 18 6-6-6-6';
const TEXTO_REQUIERE =
  'La atención requiere el consentimiento informado del acudiente';
const PREGUNTA = '¿El acudiente otorgó el consentimiento informado?';
const CONFIRMADO = 'El consentimiento informado está confirmado.';

const CASO = {
  idCaso: ID,
  fechaCreacion: '2026-11-17T15:00:00.000Z',
  estado: 'PENDIENTE',
  ruta: 'PSICOLOGICA',
  nivelRiesgo: 'MEDIO',
  estudiante: { id: 'e1', nombre: 'Camila Torres' },
  origen: {
    tipo: 'SOLICITUD',
    idOrigen: 's1',
    fecha: '2026-11-17T15:00:00.000Z',
    tipoApoyo: 'PSICOLOGICA',
    motivo: 'Me cuesta concentrarme.',
    disponibilidad: 'Martes en la tarde',
  },
  justificacion: '',
  consentimientoConfirmado: false,
  requiereConsentimiento: false,
  psicologo: null,
  presentaRiesgoCritico: false,
  citas: [] as unknown[],
};

const ANTECEDENTES = [
  {
    idRegistro: 'r1',
    curso: {
      idCurso: 'MAT101',
      nombre: 'Cálculo Diferencial',
      periodo: '2026-2',
    },
    nota: 2.1,
    porcentajeAsistencia: 61,
    ultimaSincronizacion: '2026-11-19T08:00:00.000Z',
  },
];

const CITA = {
  idCita: 'c1',
  fechaHora: '2026-11-24T20:00:00.000Z',
  modalidad: 'PRESENCIAL',
  estado: 'PROGRAMADA',
  asesoria: null,
};

const ASIGNADO = {
  ...CASO,
  estado: 'CITADO',
  psicologo: { id: 'p1', nombre: 'Paola Vargas' },
  citas: [CITA],
};

function abrirExpediente(caso: object) {
  simularApi({
    'GET /acceso/sesion': SESION,
    [DETALLE_GET]: {
      estado: 200,
      cuerpo: { caso, antecedentes: ANTECEDENTES },
    },
  });
  renderizar(RUTA);
}

describe('Remisiones (D7a, §7.5; maqueta 09)', () => {
  it('ayuda, tablas compactas, insignia de estado y «Ver expediente» que abre la fila', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /atencion/casos': { estado: 200, cuerpo: [CASO, ASIGNADO] },
    });
    renderizar('/psicologo');
    const tablas = await screen.findAllByRole('table');
    expect(
      screen.getByText('Casos remitidos a psicología.'),
    ).toBeInTheDocument();
    expect(tablas).toHaveLength(2);
    tablas.forEach((tabla) => {
      expect(tabla).toHaveClass('tabla', 'compacta');
      expect(tabla.parentElement).toHaveClass('contenedor');
    });
    const fila = screen
      .getAllByRole('rowheader', { name: 'Camila Torres' })[0]!
      .closest('tr')!;
    expect(fila).toHaveClass('fila-abrible');
    expect(within(fila).getByText('Pendiente')).toHaveClass(
      'insignia',
      'estado-neutro',
    );
    const enlace = within(fila).getByRole('link', { name: 'Ver expediente' });
    expect(enlace).toHaveClass('abrir-fila', 'abrir-fila-texto');
    expect(enlace).toHaveAccessibleDescription('Camila Torres');
    expect(enlace.querySelector('svg path')).toHaveAttribute(
      'd',
      TRAZO_CHEVRON,
    );
  });

  it.each([
    ['PENDIENTE', 'Pendiente', 'estado-neutro'],
    ['EN_NIVELACION', 'En nivelación', 'estado-azul'],
    ['EN_EVALUACION', 'En evaluación', 'estado-azul'],
    ['CITADO', 'Citado', 'estado-azul'],
    ['EN_SEGUIMIENTO', 'En seguimiento', 'estado-verde'],
    ['CERRADO', 'Cerrado', 'estado-verde'],
    ['ARCHIVADO', 'Archivado', 'estado-neutro'],
    ['REORIENTADO', 'Reorientado', 'estado-neutro'],
  ])('estado %s: «%s» con %s', async (estado, texto, tono) => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /atencion/casos': { estado: 200, cuerpo: [{ ...CASO, estado }] },
    });
    renderizar('/psicologo');
    expect(await screen.findByText(texto)).toHaveClass('insignia', tono);
  });
});

describe('Expediente: datos, antecedentes y pertinencia (D7a; maqueta 10)', () => {
  it('datos en una tarjeta con pares; nivel en insignia; motivo y disponibilidad a ancho completo', async () => {
    abrirExpediente(CASO);
    const motivo = await screen.findByText('Me cuesta concentrarme.');
    const tarjeta = motivo.closest<HTMLElement>('[class~="tarjeta"]')!;
    expect(tarjeta).not.toBeNull();
    expect(motivo.parentElement).toHaveClass('ancho-completo');
    expect(
      within(tarjeta).getByText('Martes en la tarde').parentElement,
    ).toHaveClass('ancho-completo');
    expect(within(tarjeta).getByText('Medio')).toHaveClass(
      'insignia',
      'riesgo-medio',
    );
    expect(within(tarjeta).getByText('Camila Torres')).toBeInTheDocument();
    expect(
      within(tarjeta).getByText('Solicitud de acompañamiento'),
    ).toBeInTheDocument();
  });

  it('enlace de regreso «Volver a remisiones» (§7.5 y §8)', async () => {
    abrirExpediente(CASO);
    expect(
      await screen.findByRole('link', { name: 'Volver a remisiones' }),
    ).toHaveAttribute('href', '/psicologo');
  });

  it('antecedentes en tabla cómoda dentro de su tarjeta', async () => {
    abrirExpediente(CASO);
    const titulo = await screen.findByRole('heading', {
      name: 'Antecedentes académicos',
    });
    const tarjeta = titulo.closest('section')!;
    expect(tarjeta).toHaveClass('tarjeta');
    const tabla = within(tarjeta).getByRole('table');
    expect(tabla).toHaveClass('tabla', 'comoda');
    expect(tabla.parentElement).toHaveClass('contenedor');
  });

  it('«Evaluar pertinencia» en su tarjeta, con las tres opciones en caja', async () => {
    abrirExpediente(CASO);
    const grupo = await screen.findByRole('group', {
      name: 'Evaluar pertinencia',
    });
    expect(grupo).toHaveClass('grupo-cajas');
    expect(grupo.closest('section')).toHaveClass('tarjeta');
  });
});

describe('Expediente: citas y resultado de asesoría (D7a; maqueta 11)', () => {
  it('cada cita en su tarjeta y «Resultado de asesoría» con tipo y asistencia en dos columnas', async () => {
    abrirExpediente(ASIGNADO);
    const citas = (
      await screen.findByRole('heading', { name: 'Citas' })
    ).closest('section')!;
    expect(within(citas).getByRole('article')).toHaveClass('tarjeta');

    const titulo = screen.getByRole('heading', {
      name: 'Resultado de asesoría',
    });
    const formulario = titulo.closest('form')!;
    expect(formulario.closest('article')).toHaveClass('tarjeta');
    const tipo = within(formulario).getByLabelText('Tipo de asesoría');
    const asistencia = within(formulario).getByLabelText('Asistencia');
    const columnas = tipo.closest('[class~="dos-columnas"]');
    expect(columnas).not.toBeNull();
    expect(columnas).toContainElement(asistencia);
    expect(
      within(formulario).getByRole('button', { name: 'Registrar resultado' }),
    ).toHaveClass('boton');
  });

  it('«Programar primera cita» en su tarjeta', async () => {
    abrirExpediente({
      ...CASO,
      estado: 'EN_EVALUACION',
      psicologo: { id: 'p1', nombre: 'Paola Vargas' },
    });
    const titulo = await screen.findByRole('heading', {
      name: 'Programar primera cita',
    });
    expect(titulo.closest('form')).toHaveClass('tarjeta');
  });
});

const PENDIENTE_CONSENTIMIENTO = {
  ...ASIGNADO,
  requiereConsentimiento: true,
};

function consentimientoSimulado(post: RespuestaSimulada | 'red') {
  let confirmado = false;
  return simularApi({
    'GET /acceso/sesion': SESION,
    [DETALLE_GET]: () => ({
      estado: 200,
      cuerpo: {
        caso: confirmado
          ? {
              ...PENDIENTE_CONSENTIMIENTO,
              consentimientoConfirmado: true,
              requiereConsentimiento: false,
            }
          : PENDIENTE_CONSENTIMIENTO,
        antecedentes: ANTECEDENTES,
      },
    }),
    [CONSENTIMIENTO]: () => {
      if (post === 'red') return 'red';
      confirmado = true;
      return post;
    },
  });
}

async function abrirDialogo(usuario: ReturnType<typeof userEvent.setup>) {
  const abrir = await screen.findByRole('button', {
    name: 'Confirmar consentimiento',
  });
  await usuario.click(abrir);
  const dialogo = screen.getByRole('dialog', {
    name: 'Confirmar consentimiento',
  });
  return { abrir, dialogo };
}

describe('Consentimiento en un diálogo modal (D7a, §7.6)', () => {
  it('aviso con lock y botón secundario; el diálogo no se abre solo', async () => {
    abrirExpediente(PENDIENTE_CONSENTIMIENTO);
    const abrir = await screen.findByRole('button', {
      name: 'Confirmar consentimiento',
    });
    expect(abrir).toHaveClass('boton-secundario');
    const aviso = screen.getByText(TEXTO_REQUIERE).closest('[class~="aviso"]')!;
    expect(aviso.querySelector('svg path')).toHaveAttribute(
      'd',
      'M7 11V7a5 5 0 0 1 10 0v4',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: PREGUNTA })).toBeNull();
  });

  it('al abrir: el foco entra a la casilla y «Confirmar» espera a que se marque', async () => {
    abrirExpediente(PENDIENTE_CONSENTIMIENTO);
    const usuario = userEvent.setup();
    const { dialogo } = await abrirDialogo(usuario);
    expect(dialogo).toHaveAttribute('open');
    const casilla = within(dialogo).getByRole('checkbox', { name: PREGUNTA });
    expect(casilla).toHaveFocus();
    expect(within(dialogo).getByText(TEXTO_REQUIERE)).toBeInTheDocument();
    const confirmar = within(dialogo).getByRole('button', {
      name: 'Confirmar consentimiento',
    });
    expect(confirmar).toBeDisabled();
    await usuario.click(casilla);
    expect(confirmar).toBeEnabled();
  });

  it.each([
    [
      'Cancelar',
      (u: ReturnType<typeof userEvent.setup>) =>
        u.click(screen.getByRole('button', { name: 'Cancelar' })),
    ],
    ['Esc', (u: ReturnType<typeof userEvent.setup>) => u.keyboard('{Escape}')],
  ])(
    'con %s: se cierra, el foco vuelve al botón que lo abrió y la casilla se reinicia',
    async (_, cerrar) => {
      abrirExpediente(PENDIENTE_CONSENTIMIENTO);
      const usuario = userEvent.setup();
      const { abrir, dialogo } = await abrirDialogo(usuario);
      await usuario.click(
        within(dialogo).getByRole('checkbox', { name: PREGUNTA }),
      );
      await cerrar(usuario);
      expect(dialogo).not.toHaveAttribute('open');
      expect(abrir).toHaveFocus();
      await usuario.click(abrir);
      expect(
        within(dialogo).getByRole('checkbox', { name: PREGUNTA }),
      ).not.toBeChecked();
    },
  );
});

describe('Consentimiento: confirmación y error (D7a, §7.6)', () => {
  it('al confirmar: se cierra, recarga el caso y el foco pasa al mensaje de confirmación', async () => {
    consentimientoSimulado({
      estado: 200,
      cuerpo: { consentimientoConfirmado: true },
    });
    renderizar(RUTA);
    const usuario = userEvent.setup();
    const { dialogo } = await abrirDialogo(usuario);
    await usuario.click(
      within(dialogo).getByRole('checkbox', { name: PREGUNTA }),
    );
    await usuario.click(
      within(dialogo).getByRole('button', { name: 'Confirmar consentimiento' }),
    );
    const mensaje = await screen.findByText(CONFIRMADO);
    // El foco está en el contenedor del mensaje, no en el cuerpo del documento.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toContainElement(mensaje);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Confirmar consentimiento' }),
    ).toBeNull();
  });

  it('error al confirmar: se muestra dentro del diálogo, que sigue abierto', async () => {
    consentimientoSimulado('red');
    renderizar(RUTA);
    const usuario = userEvent.setup();
    const { dialogo } = await abrirDialogo(usuario);
    await usuario.click(
      within(dialogo).getByRole('checkbox', { name: PREGUNTA }),
    );
    await usuario.click(
      within(dialogo).getByRole('button', { name: 'Confirmar consentimiento' }),
    );
    expect(await within(dialogo).findByRole('alert')).toBeInTheDocument();
    expect(dialogo).toHaveAttribute('open');
  });
});
