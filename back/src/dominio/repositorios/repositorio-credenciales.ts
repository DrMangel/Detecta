/**
 * Contrato `RepositorioCredenciales` (D6, aprobado por Ivan en el plan de B3;
 * NO está en el diagrama de clases v3: se reporta como diferencia).
 *
 * `Persona` es inmutable y el diagrama no tiene una operación para cambiar la
 * contraseña; este contrato escribe el hash bcrypt y gestiona los tokens de
 * activación/recuperación sin modificar el dominio.
 *
 * Los tokens se guardan solo como hash SHA-256: el token en claro nunca se
 * persiste. Ninguna operación borra filas (ER 3.7 c: la app no tiene DELETE).
 */
export interface RepositorioCredenciales {
  /**
   * Registra un token nuevo para la persona y anula los anteriores sin usar,
   * en una sola transacción.
   */
  registrarToken(token: {
    idToken: string;
    idPersona: string;
    hashToken: string;
    creadoEn: Date;
    expiraEn: Date;
  }): Promise<void>;

  /** Tokens emitidos para la persona desde `desde` (límite de D16). */
  contarTokensDesde(idPersona: string, desde: Date): Promise<number>;

  /**
   * Canjea un token vigente (no usado, no anulado y no caducado en `ahora`):
   * lo marca usado y guarda el nuevo hash de la contraseña de su persona, en
   * una sola transacción. Devuelve false si el token no es canjeable.
   */
  canjearToken(
    hashToken: string,
    contrasenaHash: string,
    ahora: Date,
  ): Promise<boolean>;
}
