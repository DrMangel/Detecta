import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  CASO_ALERTA,
  DETALLE_ALERTA,
  ID_CASO_SECRETO,
  PLAN,
} from './datos-jefe';
import {
  renderizar,
  sesionDe,
  simularApi,
  type LlamadaRegistrada,
  type RespuestaSimulada,
} from './utilidades';

/*
 * Criterio de cierre de F3, «el plan se registra y se finaliza» (CUD05;
 * sd_CUD04, «extend» CUD05 y extensión 1.a; respuesta 1 y decisión sobre el
 * resultado incierto de F3).
 */

const SESION = { estado: 200, cuerpo: sesionDe('JEFE_DEPARTAMENTO') };
const CANALIZADO = {
  estado: 200,
  cuerpo: {
    mensaje: 'Caso canalizado a la ruta académica',
    caso: { ...CASO_ALERTA, ruta: 'ACADEMICA', estado: 'EN_NIVELACION' },
  },
};

type Simulacion = RespuestaSimulada | 'red';

/** Abre el detalle, canaliza a la ruta académica y deja el plan a la vista. */
async function abrirPlan(registro: Simulacion | (() => Simulacion)) {
  const api = simularApi({
    'GET /acceso/sesion': SESION,
    [`GET /casos/${ID_CASO_SECRETO}`]: { estado: 200, cuerpo: DETALLE_ALERTA },
    [`POST /casos/${ID_CASO_SECRETO}/canalizacion`]: CANALIZADO,
    'POST /planes': registro,
    'POST /planes/plan-1/finalizacion': {
      estado: 200,
      cuerpo: { plan: { ...PLAN, estado: 'FINALIZADO' } },
    },
  });
  renderizar(`/jefe-departamento/casos/${ID_CASO_SECRETO}`);
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByLabelText('Ruta académica'));
  await usuario.click(screen.getByRole('button', { name: 'Canalizar caso' }));
  await screen.findByRole('heading', { name: 'Plan de nivelación' });
  return { ...api, usuario };
}

async function llenar(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('Nombre del tutor'), 'Marta Ruiz');
  await usuario.type(screen.getByLabelText('Código del tutor'), 'T-77');
  await usuario.click(screen.getByLabelText('Cálculo Integral (2026-2)'));
}

const posts = (llamadas: readonly LlamadaRegistrada[]) =>
  llamadas.filter((l) => l.metodo === 'POST' && l.url === '/api/planes');

describe('Plan de nivelación (CUD05)', () => {
  it('cursos del estudiante como opciones y límites del contrato', async () => {
    await abrirPlan({ estado: 201 });
    expect(screen.getByLabelText('Física I (2026-2)')).not.toBeChecked();
    expect(screen.getByLabelText('Nombre del tutor')).toHaveAttribute(
      'maxLength',
      '150',
    );
    expect(screen.getByLabelText('Código del tutor')).toHaveAttribute(
      'maxLength',
      '20',
    );
    expect(screen.getByLabelText('Cronograma (opcional)')).toHaveAttribute(
      'maxLength',
      '2000',
    );
  });

  it('sin tutor: «Faltan los datos del estudiante tutor» y no envía', async () => {
    const { llamadas, usuario } = await abrirPlan({ estado: 201 });
    await usuario.click(screen.getByLabelText('Cálculo Integral (2026-2)'));
    await usuario.click(screen.getByRole('button', { name: 'Registrar plan' }));
    expect(
      await screen.findByText('Faltan los datos del estudiante tutor'),
    ).toBeInTheDocument();
    expect(posts(llamadas)).toHaveLength(0);
  });

  it('sin cursos: «Seleccione al menos un curso» y no envía', async () => {
    const { llamadas, usuario } = await abrirPlan({ estado: 201 });
    await usuario.type(screen.getByLabelText('Nombre del tutor'), 'Marta');
    await usuario.type(screen.getByLabelText('Código del tutor'), 'T-77');
    await usuario.click(screen.getByRole('button', { name: 'Registrar plan' }));
    expect(
      await screen.findByText('Seleccione al menos un curso'),
    ).toBeInTheDocument();
    expect(posts(llamadas)).toHaveLength(0);
  });
});

describe('Plan de nivelación: registro y finalización (CUD05)', () => {
  it('registra: mensaje, datos del plan y «Finalizar plan»; al finalizar queda «Finalizado»', async () => {
    const { llamadas, usuario } = await abrirPlan({
      estado: 201,
      cuerpo: { mensaje: 'Plan de nivelación registrado', plan: PLAN },
    });
    await llenar(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Registrar plan' }));
    expect(
      await screen.findByText('Plan de nivelación registrado'),
    ).toBeInTheDocument();
    expect(posts(llamadas)[0]?.cuerpo).toEqual({
      idCaso: ID_CASO_SECRETO,
      idsCursos: ['MAT-201'],
      tutorNombre: 'Marta Ruiz',
      tutorCodigo: 'T-77',
      cronograma: '',
    });
    expect(screen.getByText('Activo')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Finalizar plan' }));
    expect(await screen.findByText('Finalizado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizar plan' })).toBeNull();
  });

  it('error de red al registrar el plan muestra el texto y bloquea un segundo envío', async () => {
    const { llamadas, usuario } = await abrirPlan('red');
    await llenar(usuario);
    const boton = screen.getByRole('button', { name: 'Registrar plan' });
    await usuario.click(boton);
    expect(
      await screen.findByText(
        'No se pudo confirmar si el plan fue registrado. Para evitar un plan duplicado, no puede registrarse de nuevo desde esta pantalla.',
      ),
    ).toBeInTheDocument();
    expect(boton).toBeDisabled();
    await usuario.click(boton);
    expect(posts(llamadas)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Finalizar plan' })).toBeNull();
  });
});

describe('Plan de nivelación: fallos ciertos (CUD05)', () => {
  it('503 permite reintentar con los datos conservados', async () => {
    let intentos = 0;
    const { llamadas, usuario } = await abrirPlan(() => {
      intentos += 1;
      return intentos === 1
        ? {
            estado: 503,
            cuerpo: { message: 'Error al registrar el plan de nivelación' },
          }
        : {
            estado: 201,
            cuerpo: { mensaje: 'Plan de nivelación registrado', plan: PLAN },
          };
    });
    await llenar(usuario);
    const boton = screen.getByRole('button', { name: 'Registrar plan' });
    await usuario.click(boton);
    expect(
      await screen.findByText('Error al registrar el plan de nivelación'),
    ).toBeInTheDocument();
    expect(boton).toBeEnabled();
    expect(screen.getByLabelText('Nombre del tutor')).toHaveValue('Marta Ruiz');
    await usuario.click(boton);
    expect(
      await screen.findByText('Plan de nivelación registrado'),
    ).toBeInTheDocument();
    expect(posts(llamadas)).toHaveLength(2);
  });

  it('el bloqueo no persiste en el almacenamiento del navegador', async () => {
    const { usuario } = await abrirPlan('red');
    await llenar(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Registrar plan' }));
    await screen.findByText(/No se pudo confirmar si el plan fue registrado/);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
