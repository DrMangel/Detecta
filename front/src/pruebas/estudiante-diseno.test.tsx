import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderizar, sesionDe, simularApi } from './utilidades';

/*
 * Pantallas del Estudiante con el diseño de F5b (D4b; especificación §7.2):
 * cifras con barra de asistencia, avisos de alerta por nivel, insignias de
 * estado y copia tuteada del periodo vacío (el Docente conserva «Indique…»).
 */

const SESION = { estado: 200, cuerpo: sesionDe('ESTUDIANTE') };

const registro = (
  porcentajeAsistencia: number | null,
  nota: number | null,
) => ({
  idRegistro: `R-${String(porcentajeAsistencia)}`,
  curso: { idCurso: 'C1', nombre: 'Cálculo I', periodo: '2026-2' },
  nota,
  porcentajeAsistencia,
  ultimaSincronizacion: '2026-11-19T15:00:00.000Z',
});

const alerta = (nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO') => ({
  idAlerta: `A-${nivelRiesgo}`,
  fecha: '2026-11-20T15:00:00.000Z',
  curso: 'Física I',
  nivelRiesgo,
  descripcion: `Descripción ${nivelRiesgo}`,
});

async function consultar(
  registros: unknown[],
  alertas: unknown[] = [],
): Promise<HTMLElement> {
  simularApi({
    'GET /acceso/sesion': SESION,
    'GET /consulta/registros?periodo=2026-2': {
      estado: 200,
      cuerpo: { registros },
    },
    'GET /consulta/alertas?periodo=2026-2': { estado: 200, cuerpo: alertas },
  });
  renderizar('/estudiante');
  const usuario = userEvent.setup();
  await usuario.type(
    await screen.findByLabelText('Periodo académico'),
    '2026-2',
  );
  await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
  return screen.findByRole('main');
}

describe('Consulta académica con cifras y avisos (D4b)', () => {
  it('ayuda bajo el título y «Mis asignaturas · {periodo}»', async () => {
    const principal = within(await consultar([registro(87.5, 3.45)]));
    expect(
      principal.getByText('Aquí puedes ver cómo vas en tus asignaturas.'),
    ).toBeInTheDocument();
    expect(
      await principal.findByRole('heading', {
        name: 'Mis asignaturas · 2026-2',
      }),
    ).toBeInTheDocument();
  });

  it('cifras «Nota acumulada» y «Asistencia», con la barra al porcentaje', async () => {
    const principal = within(await consultar([registro(87.5, 3.45)]));
    const tarjetaLi = (await principal.findAllByRole('listitem'))[0]!;
    const tarjeta = within(tarjetaLi);
    expect(tarjeta.getByText('3,45')).toBeInTheDocument();
    expect(tarjeta.getByText('Nota acumulada')).toBeInTheDocument();
    expect(tarjeta.getByText('87,50 %')).toBeInTheDocument();
    expect(tarjeta.getByText('Asistencia')).toBeInTheDocument();
    const barra = tarjetaLi.querySelector('.barra')!;
    expect(barra).toHaveAttribute('aria-hidden', 'true');
    expect(barra.firstElementChild).toHaveStyle({ width: '87.5%' });
  });

  it.each([
    [140, '100%'],
    [-5, '0%'],
  ])('la barra se limita a 0–100: %s → %s', async (valor, ancho) => {
    const principal = within(await consultar([registro(valor, 3)]));
    const tarjetaLi = (await principal.findAllByRole('listitem'))[0]!;
    expect(tarjetaLi.querySelector('.barra')!.firstElementChild).toHaveStyle({
      width: ancho,
    });
  });

  it('sin dato de asistencia ni de nota: «Información no disponible» y sin barra', async () => {
    const principal = within(await consultar([registro(null, null)]));
    const tarjetaLi = (await principal.findAllByRole('listitem'))[0]!;
    const tarjeta = within(tarjetaLi);
    expect(tarjeta.getAllByText('Información no disponible')).toHaveLength(2);
    expect(tarjetaLi.querySelector('.barra')).toBeNull();
  });

  it('periodo sin registros: «Información no disponible» como aviso informativo', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/registros?periodo=2025-1': {
        estado: 200,
        cuerpo: { registros: [], mensaje: 'Información no disponible' },
      },
      'GET /consulta/alertas?periodo=2025-1': { estado: 200, cuerpo: [] },
    });
    renderizar('/estudiante');
    const usuario = userEvent.setup();
    await usuario.type(
      await screen.findByLabelText('Periodo académico'),
      '2025-1',
    );
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Información no disponible');
    expect(aviso).toHaveClass('informativo');
  });
});

describe('Avisos de alerta por nivel (D4b, §7.2)', () => {
  it.each([
    ['BAJO', 'Riesgo bajo · Física I', 'M20 6 9 17l-5-5'],
    [
      'MEDIO',
      'Riesgo medio · Física I',
      'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
    ],
    ['ALTO', 'Riesgo alto · Física I', 'M12 16h.01'],
  ] as const)(
    'aviso %s: título «%s», su ícono, fecha y descripción; enlace solo en medio y alto',
    async (nivel, titulo, trazo) => {
      const principal = within(
        await consultar([registro(90, 4)], [alerta(nivel)]),
      );
      const aviso = (await principal.findByText(titulo)).closest('li')!;
      expect(aviso).toHaveClass(`riesgo-${nivel.toLowerCase()}`);
      expect(aviso.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(aviso.querySelector('svg path')).toHaveAttribute('d', trazo);
      expect(within(aviso).getByText('20/11/2026')).toBeInTheDocument();
      expect(
        within(aviso).getByText(`Descripción ${nivel}`),
      ).toBeInTheDocument();
      const enlace = within(aviso).queryByRole('link', {
        name: 'Solicitar acompañamiento',
      });
      if (nivel !== 'BAJO') {
        expect(enlace).toHaveAttribute('href', '/estudiante/solicitudes/nueva');
        return;
      }
      expect(enlace).toBeNull();
    },
  );
});

describe('Periodo vacío según el rol (D4b, decisión 1)', () => {
  it('Estudiante: «Indica el periodo académico.»', async () => {
    simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/estudiante');
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Consultar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Indica el periodo académico.',
    );
  });

  it('Docente: conserva «Indique el periodo académico.»', async () => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('DOCENTE') },
    });
    renderizar('/docente/alertas');
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Consultar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Indique el periodo académico.',
    );
  });
});

describe('Mis solicitudes y solicitud (D4b)', () => {
  it('el estado de cada solicitud es una insignia con su texto', async () => {
    simularApi({
      'GET /acceso/sesion': SESION,
      'GET /consulta/solicitudes': {
        estado: 200,
        cuerpo: [
          {
            codigo: 'c1',
            fecha: '2026-11-18T15:00:00.000Z',
            tipoApoyo: 'ACADEMICA',
            motivo: 'M1',
            disponibilidad: '',
            estado: 'PENDIENTE',
          },
          {
            codigo: 'c2',
            fecha: '2026-11-18T15:00:00.000Z',
            tipoApoyo: 'PSICOLOGICA',
            motivo: 'M2',
            disponibilidad: '',
            estado: 'ATENDIDA',
          },
        ],
      },
    });
    renderizar('/estudiante/solicitudes');
    expect(await screen.findByText('Pendiente')).toHaveClass(
      'insignia',
      'estado-neutro',
    );
    expect(screen.getByText('Atendida')).toHaveClass(
      'insignia',
      'estado-verde',
    );
  });

  it('la solicitud lleva su ayuda y el botón «Enviar solicitud» con el ícono send', async () => {
    simularApi({ 'GET /acceso/sesion': SESION });
    renderizar('/estudiante/solicitudes/nueva');
    expect(
      await screen.findByText(
        'Cuéntanos qué necesitas; tu solicitud se trata con respeto y confidencialidad.',
      ),
    ).toBeInTheDocument();
    const enviar = screen.getByRole('button', { name: 'Enviar solicitud' });
    expect(enviar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
