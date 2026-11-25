import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Rol } from '../servicios-api/tipos';
import { enlaceMenu, renderizar, sesionDe, simularApi } from './utilidades';

/*
 * Pantalla de inicio de cada rol (especificación de diseño §7.0, ER 3.7 h):
 * saludo, ayuda y una tarjeta-enlace por cada función del menú, sin datos.
 */

const AYUDA =
  'Estas son las funciones disponibles para tu rol y para qué sirve cada una.';
const INFORMES =
  'Genera informes con totales por asignatura y periodo, sin datos personales.';

const CASOS: [Rol, string, [string, string, string][]][] = [
  [
    'ESTUDIANTE',
    '/estudiante/inicio',
    [
      [
        'Consulta académica',
        '/estudiante',
        'Revisa tus notas, tu asistencia y tus alertas por periodo.',
      ],
      [
        'Mis solicitudes',
        '/estudiante/solicitudes',
        'Consulta el estado de las solicitudes de acompañamiento que has enviado.',
      ],
      [
        'Solicitar acompañamiento',
        '/estudiante/solicitudes/nueva',
        'Pide apoyo académico o psicosocial. Tu solicitud solo la ve el personal que la atiende.',
      ],
    ],
  ],
  [
    'DOCENTE',
    '/docente/inicio',
    [
      [
        'Consulta de curso',
        '/docente',
        'Revisa las notas y la asistencia de tu curso y emite alertas tempranas.',
      ],
      [
        'Alertas emitidas',
        '/docente/alertas',
        'Consulta las alertas que has emitido en el periodo.',
      ],
    ],
  ],
  [
    'JEFE_DEPARTAMENTO',
    '/jefe-departamento/inicio',
    [
      [
        'Casos pendientes',
        '/jefe-departamento',
        'Revisa los casos recibidos y canalízalos a la ruta académica o psicológica.',
      ],
      [
        'En ruta académica',
        '/jefe-departamento/ruta-academica',
        'Consulta los casos canalizados a la ruta académica y gestiona sus planes de nivelación.',
      ],
      ['Informes de riesgo', '/jefe-departamento/informes', INFORMES],
    ],
  ],
  [
    'PSICOLOGO',
    '/psicologo/inicio',
    [
      [
        'Remisiones',
        '/psicologo',
        'Atiende los casos remitidos a psicología y consulta sus expedientes.',
      ],
      ['Informes de riesgo', '/psicologo/informes', INFORMES],
    ],
  ],
];

const principal = () => within(screen.getByRole('main'));

describe('Inicio de cada rol (F5b-diseño, D4a)', () => {
  it.each(CASOS)(
    '%s: saludo, ayuda, «Inicio» activo y una tarjeta por función',
    async (rol, ruta, tarjetas) => {
      simularApi({
        'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe(rol) },
      });
      renderizar(ruta);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Usuario' }),
      ).toBeInTheDocument();
      expect(principal().getByText(AYUDA)).toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe('Inicio · DETECTA'));
      const menu = within(screen.getByRole('navigation')).getAllByRole('link');
      expect(menu[0]).toHaveTextContent('Inicio');
      expect(enlaceMenu('Inicio')).toHaveAttribute('aria-current', 'page');
      const enlaces = principal().getAllByRole('link');
      expect(enlaces).toHaveLength(tarjetas.length);
      tarjetas.forEach(([titulo, destino, descripcion], indice) => {
        const tarjeta = enlaces[indice]!;
        expect(tarjeta).toHaveTextContent(titulo);
        expect(tarjeta).toHaveTextContent(descripcion);
        expect(tarjeta).toHaveAttribute('href', destino);
      });
    },
  );

  it('Estudiante: «Solicitar acompañamiento» destacada y con la insignia «Confidencial»', async () => {
    simularApi({
      'GET /acceso/sesion': { estado: 200, cuerpo: sesionDe('ESTUDIANTE') },
    });
    renderizar('/estudiante/inicio');
    await screen.findByRole('main');
    const solicitar = await principal().findByRole('link', {
      name: /Solicitar acompañamiento/,
    });
    expect(solicitar).toHaveClass('destacada');
    expect(within(solicitar).getByText('Confidencial')).toBeInTheDocument();
    const otras = principal()
      .getAllByRole('link')
      .filter((enlace) => enlace !== solicitar);
    for (const enlace of otras) {
      expect(enlace).not.toHaveClass('destacada');
      expect(enlace).not.toHaveTextContent('Confidencial');
    }
  });

  it('sin sesión, el inicio lleva al inicio de sesión', async () => {
    simularApi({
      'GET /acceso/sesion': {
        estado: 401,
        cuerpo: { message: 'Sesión no válida o caducada' },
      },
    });
    renderizar('/docente/inicio');
    await waitFor(() =>
      expect(screen.getByTestId('ruta')).toHaveTextContent('/iniciar-sesion'),
    );
  });
});
