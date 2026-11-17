import * as bcrypt from 'bcrypt';

/**
 * Operaciones bcrypt (ER 3.6.2: "algoritmo de hash criptográfico reconocido
 * (como bcrypt)"; ER 3.7 c: contraseñas no recuperables). Se agrupan en un
 * objeto para que las pruebas verifiquen cuántas veces se compara (ajuste A
 * de Ivan: una comparación en todas las ramas del inicio de sesión).
 */
export const hashContrasenas = {
  generar(contrasena: string, costo: number): Promise<string> {
    return bcrypt.hash(contrasena, costo);
  },
  comparar(contrasena: string, hash: string): Promise<boolean> {
    return bcrypt.compare(contrasena, hash);
  },
};

/** Formato de un hash bcrypt: $2a$/$2b$/$2y$, costo de 2 dígitos y 53 caracteres. */
const FORMATO_BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function esHashBcrypt(valor: string): boolean {
  return FORMATO_BCRYPT.test(valor);
}

/**
 * Valor de `contrasena_hash` de una cuenta sin activar (D6): no es un hash
 * bcrypt, así que ninguna contraseña coincide con él.
 */
export const HASH_SIN_ACTIVAR = '!SIN_ACTIVAR';
