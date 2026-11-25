import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  CASO_ACADEMICO,
  CASO_ALERTA,
  CASO_SOLICITUD,
  DETALLE_ALERTA,
  ID_CASO_SECRETO,
  PLAN,
  PLAN_CASO,
} from './datos-jefe';
import { renderizar, sesionDe, simularApi } from './utilidades';

/*
 * Pantallas del Jefe con el diseño de F5b (D6; especificación §6 y §7.4;
 * maquetas 06, 07, 08 y 18): bandejas con tabla compacta y fila que se
 * abre, línea de estado, datos en tarjetas, «Ruta de atención» y planes en
 * tarjetas.
 */

const SESION = { estado: 200, cuerpo: sesionDe('JEFE_DEPARTAMENTO') };
const DETALLE = `GET /casos/${ID_CASO_SECRETO}`;
const CANALIZAR = `POST /casos/${ID_CASO_SECRETO}/canalizacion`;
const RUTA_DETALLE = `/jefe-departamento/casos/${ID_CASO_SECRETO}`;
const TRAZO_CHEVRON = 'm9 18 6-6-6-6';

function abrirDetalle(cuerpo: unknown) {
  simularApi({
    'GET /acceso/sesion': SESION,
    [DETALLE]: { estado: 200, cuerpo },
  });
  renderizar(RUTA_DETALLE);
}

const paso = (rotulo: string) => screen.getByText(rotulo).closest('li')!;

describe('Bandejas del Jefe (D6, §7.4)', () => {
  it('casos pendientes: ayuda, tabla compacta, insignia de nivel o «—» y la fila que se abre', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/pendientes': {
        estado: 200,
        cuerpo: [CASO_ALERTA, CASO_SOLICITUD],
      },
    });
    renderizar('/jefe-departamento');
    const tabla = await screen.findByRole('table');
    expect(
      screen.getByText('Selecciona un caso para ver su detalle y canalizarlo.'),
    ).toBeInTheDocument();
    expect(tabla).toHaveClass('tabla', 'compacta');
    expect(tabla.parentElement).toHaveClass('contenedor');
    expect(
      within(tabla).getByRole('columnheader', { name: 'Abrir' }),
    ).toBeInTheDocument();

    const laura = within(tabla)
      .getByRole('rowheader', { name: 'Laura Gómez' })
      .closest('tr')!;
    expect(laura).toHaveClass('fila-abrible');
    expect(within(laura).getByText('Alto')).toHaveClass(
      'insignia',
      'riesgo-alto',
    );
    const boton = within(laura).getByRole('button', {
      name: 'Detalle del caso',
    });
    expect(boton).toHaveClass('abrir-fila');
    expect(boton).toHaveAccessibleDescription('Laura Gómez');
    expect(boton.querySelector('svg path')).toHaveAttribute('d', TRAZO_CHEVRON);

    const pedro = within(tabla)
      .getByRole('rowheader', { name: 'Pedro Tres' })
      .closest('tr')!;
    expect(within(pedro).getByText('—')).not.toHaveClass('insignia');
  });

  it('en ruta académica: su ayuda (maqueta 18)', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /casos/ruta-academica': { estado: 200, cuerpo: [CASO_ACADEMICO] },
    });
    renderizar('/jefe-departamento/ruta-academica');
    await screen.findByRole('table');
    expect(
      screen.getByText(
        'Selecciona un caso para ver su detalle y gestionar sus planes de nivelación.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Línea de estado del detalle (D6, §7.4)', () => {
  it('sin ruta: «Caso recibido» hecho, «Canalización» actual y «Plan de nivelación» pendiente', async () => {
    abrirDetalle(DETALLE_ALERTA);
    await screen.findByText('Caso recibido');
    expect(paso('Caso recibido')).toHaveClass('hecho');
    expect(paso('Canalización')).toHaveAttribute('aria-current', 'step');
    expect(paso('Plan de nivelación')).toHaveClass('pendiente');
  });

  it('ruta psicológica: los dos primeros hechos y sin el tercer paso', async () => {
    abrirDetalle({
      ...DETALLE_ALERTA,
      caso: { ...CASO_ALERTA, ruta: 'PSICOLOGICA', estado: 'EN_ATENCION' },
    });
    await screen.findByText('Caso recibido');
    expect(paso('Caso recibido')).toHaveClass('hecho');
    expect(paso('Canalización')).toHaveClass('hecho');
    expect(screen.queryByText('Plan de nivelación')).toBeNull();
  });

  it('ruta académica sin planes: «Plan de nivelación» actual', async () => {
    abrirDetalle({ ...DETALLE_ALERTA, caso: CASO_ACADEMICO });
    await screen.findByText('Caso recibido');
    expect(paso('Canalización')).toHaveClass('hecho');
    expect(paso('Plan de nivelación')).toHaveAttribute('aria-current', 'step');
  });

  it('al registrar un plan, «Plan de nivelación» pasa de actual a hecho', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [DETALLE]: {
        estado: 200,
        cuerpo: { ...DETALLE_ALERTA, caso: CASO_ACADEMICO },
      },
      'POST /planes': {
        estado: 201,
        cuerpo: { mensaje: 'Plan de nivelación registrado', plan: PLAN },
      },
    });
    renderizar(RUTA_DETALLE);
    const usuario = userEvent.setup();
    await usuario.type(
      await screen.findByLabelText('Nombre del tutor'),
      'Marta Ruiz',
    );
    await usuario.type(screen.getByLabelText('Código del tutor'), 'T-77');
    await usuario.click(screen.getByLabelText('Cálculo Integral (2026-2)'));
    expect(paso('Plan de nivelación')).toHaveAttribute('aria-current', 'step');
    await usuario.click(screen.getByRole('button', { name: 'Registrar plan' }));
    await screen.findByText('Plan de nivelación registrado');
    expect(paso('Plan de nivelación')).toHaveClass('hecho');
  });

  it.each(['ACTIVO', 'FINALIZADO'])(
    'ruta académica con un plan %s: los tres pasos hechos («con plan registrado»)',
    async (estado) => {
      abrirDetalle({
        ...DETALLE_ALERTA,
        caso: CASO_ACADEMICO,
        planes: [{ ...PLAN_CASO, estado }],
      });
      await screen.findByText('Caso recibido');
      expect(paso('Plan de nivelación')).toHaveClass('hecho');
      expect(paso('Plan de nivelación')).not.toHaveAttribute('aria-current');
    },
  );
});

describe('Datos y antecedentes del detalle (D6, §7.4)', () => {
  it('«Datos del caso» en tarjeta: nivel en insignia y justificación a ancho completo', async () => {
    abrirDetalle(DETALLE_ALERTA);
    const titulo = await screen.findByRole('heading', {
      name: 'Datos del caso',
    });
    const tarjeta = titulo.closest('section')!;
    expect(tarjeta).toHaveClass('tarjeta');
    expect(within(tarjeta).getByText('Alto')).toHaveClass('insignia');
    expect(
      within(tarjeta).getByText('Inasistencias en las últimas semanas.')
        .parentElement,
    ).toHaveClass('ancho-completo');
  });

  it('solicitud: nivel «—» sin insignia y el motivo a ancho completo', async () => {
    abrirDetalle({ ...DETALLE_ALERTA, caso: CASO_SOLICITUD });
    const titulo = await screen.findByRole('heading', {
      name: 'Datos del caso',
    });
    const tarjeta = titulo.closest('section')!;
    expect(within(tarjeta).getByText('—')).not.toHaveClass('insignia');
    expect(
      within(tarjeta).getByText('Necesito apoyo en Cálculo.').parentElement,
    ).toHaveClass('ancho-completo');
  });

  it('antecedentes en tabla cómoda dentro de su tarjeta', async () => {
    abrirDetalle(DETALLE_ALERTA);
    const titulo = await screen.findByRole('heading', {
      name: 'Antecedentes académicos',
    });
    const tarjeta = titulo.closest('section')!;
    expect(tarjeta).toHaveClass('tarjeta');
    const tabla = within(tarjeta).getByRole('table');
    expect(tabla).toHaveClass('tabla', 'comoda');
    expect(tabla.parentElement).toHaveClass('contenedor');
  });
});

describe('Canalización y ruta de atención (D6, §7.4)', () => {
  it('«Ruta de atención» y la ayuda del botón solo mientras no hay ruta', async () => {
    abrirDetalle(DETALLE_ALERTA);
    const grupo = await screen.findByRole('group', {
      name: 'Ruta de atención',
    });
    expect(grupo.closest('section')).toHaveClass('tarjeta');
    const boton = screen.getByRole('button', { name: 'Canalizar caso' });
    expect(boton).toHaveAccessibleDescription(
      'Selecciona una ruta para continuar.',
    );
    await userEvent.setup().click(screen.getByLabelText('Ruta académica'));
    expect(
      screen.queryByText('Selecciona una ruta para continuar.'),
    ).toBeNull();
    expect(boton).not.toHaveAccessibleDescription();
  });

  it('caso reabierto: tarjeta «Ruta de atención: Ruta académica», sin confirmación', async () => {
    abrirDetalle({ ...DETALLE_ALERTA, caso: CASO_ACADEMICO });
    const rotulo = await screen.findByText('Ruta de atención');
    expect(rotulo.closest('p')).toHaveTextContent(
      'Ruta de atención: Ruta académica',
    );
    expect(rotulo.closest('p')).toHaveClass('tarjeta');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('recién canalizado: la confirmación y debajo la tarjeta de la ruta', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      [DETALLE]: { estado: 200, cuerpo: DETALLE_ALERTA },
      [CANALIZAR]: {
        estado: 200,
        cuerpo: {
          mensaje: 'Caso canalizado a la ruta académica',
          caso: CASO_ACADEMICO,
        },
      },
    });
    renderizar(RUTA_DETALLE);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByLabelText('Ruta académica'));
    await usuario.click(screen.getByRole('button', { name: 'Canalizar caso' }));
    const confirmacion = await screen.findByRole('status');
    expect(confirmacion).toHaveTextContent(
      'Caso canalizado a la ruta académica',
    );
    const tarjeta = screen.getByText('Ruta de atención').closest('p')!;
    expect(tarjeta).toHaveTextContent('Ruta de atención: Ruta académica');
    expect(
      confirmacion.compareDocumentPosition(tarjeta) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

const FINALIZADO = {
  ...PLAN_CASO,
  idPlan: 'plan-0',
  estado: 'FINALIZADO',
  tutorNombre: 'Carlos Mendoza',
  cronograma: 'Lunes 2:00 p. m.\nJueves 4:00 p. m.',
};

describe('Planes del caso (D6, maqueta 08)', () => {
  it('cada plan en su tarjeta, numerado en el orden del backend, con insignia, tutor y cronograma', async () => {
    abrirDetalle({
      ...DETALLE_ALERTA,
      caso: CASO_ACADEMICO,
      planes: [FINALIZADO, PLAN_CASO],
    });
    const seccion = (
      await screen.findByRole('heading', { name: 'Planes del caso' })
    ).closest('section')!;
    const titulos = within(seccion).getAllByRole('heading', { level: 3 });
    expect(titulos.map((t) => t.textContent)).toEqual(['Plan 1', 'Plan 2']);

    const plan1 = titulos[0]!.closest('article')!;
    expect(plan1).toHaveClass('tarjeta');
    expect(within(plan1).getByText('Finalizado')).toHaveClass(
      'insignia',
      'estado-neutro',
    );
    expect(within(plan1).getByText('Tutor')).toBeInTheDocument();
    expect(within(plan1).getByText('Carlos Mendoza')).toBeInTheDocument();
    const cronograma = within(plan1).getByText(/Lunes 2:00/);
    // Texto libre: a lo ancho y con sus saltos de línea (pre-wrap).
    expect(cronograma.parentElement).toHaveClass('ancho-completo');
    expect(cronograma.textContent).toBe('Lunes 2:00 p. m.\nJueves 4:00 p. m.');
    expect(within(plan1).queryByRole('button')).toBeNull();

    const plan2 = titulos[1]!.closest('article')!;
    expect(within(plan2).getByText('Activo')).toHaveClass(
      'insignia',
      'estado-azul',
    );
    // Cronograma vacío: el par no se muestra.
    expect(within(plan2).queryByText('Cronograma')).toBeNull();
    expect(
      within(plan2).getByRole('button', { name: 'Finalizar plan' }),
    ).toHaveClass('boton-secundario');

    // D29: con un plan activo no hay formulario.
    expect(
      screen.queryByRole('heading', { name: 'Registrar plan de nivelación' }),
    ).toBeNull();
  });

  it('sin plan activo: «Registrar plan de nivelación» en tarjeta, al final, con el tutor en dos columnas y el contador alineado', async () => {
    abrirDetalle({
      ...DETALLE_ALERTA,
      caso: CASO_ACADEMICO,
      planes: [FINALIZADO],
    });
    const titulo = await screen.findByRole('heading', {
      name: 'Registrar plan de nivelación',
    });
    const tarjeta = titulo.closest('section')!;
    expect(tarjeta).toHaveClass('tarjeta');
    const plan1 = screen.getByRole('heading', { name: 'Plan 1' });
    expect(
      plan1.compareDocumentPosition(tarjeta) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const nombre = within(tarjeta).getByLabelText('Nombre del tutor');
    const codigo = within(tarjeta).getByLabelText('Código del tutor');
    const tutor = nombre.closest('[class~="tutor"]');
    expect(tutor).not.toBeNull();
    expect(tutor).toContainElement(codigo);
    expect(within(tarjeta).getByText('0 / 2000')).toHaveClass('contador');
  });
});
