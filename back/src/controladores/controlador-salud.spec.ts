import { ControladorSalud } from './controlador-salud';

/*
 * F6 (monitor J3): la ruta de salud no tiene dependencias, así que no puede
 * consultar la base, el limitador ni la configuración.
 */
describe('ControladorSalud', () => {
  it('se construye sin dependencias', () => {
    expect(ControladorSalud.length).toBe(0);
  });

  it('responde siempre el mismo cuerpo fijo', () => {
    expect(new ControladorSalud().consultar()).toEqual({ estado: 'ok' });
  });
});
