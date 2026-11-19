/*
 * Declaración mínima de pg para la prueba de B9 (R9). El proyecto no usa
 * @types/pg y B9 no agrega dependencias; solo se tipa lo que la prueba usa.
 */
declare module 'pg' {
  export const Client: {
    prototype: { query: (...argumentos: unknown[]) => unknown };
  };
}
