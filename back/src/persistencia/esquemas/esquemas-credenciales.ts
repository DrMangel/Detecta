import { EntitySchema } from 'typeorm';

/**
 * Tokens de activación/recuperación de cuenta (D6, B3). Solo se guarda el
 * SHA-256 del token; el token en claro viaja únicamente en el enlace del
 * correo. Un token se usa una vez (`usadoEn`) y se anula al emitir otro
 * (`anuladoEn`); nunca se borra (sin DELETE, ER 3.7 c).
 */
export interface FilaTokenActivacion {
  idToken: string;
  idPersona: string;
  hashToken: string;
  creadoEn: Date;
  expiraEn: Date;
  usadoEn: Date | null;
  anuladoEn: Date | null;
}

export const EsquemaTokenActivacion = new EntitySchema<FilaTokenActivacion>({
  name: 'TokenActivacion',
  tableName: 'token_activacion',
  columns: {
    idToken: { name: 'id_token', type: 'varchar', length: 36, primary: true },
    idPersona: { name: 'id_persona', type: 'varchar', length: 36 },
    hashToken: { name: 'hash_token', type: 'char', length: 64, unique: true },
    creadoEn: { name: 'creado_en', type: 'timestamptz' },
    expiraEn: { name: 'expira_en', type: 'timestamptz' },
    usadoEn: { name: 'usado_en', type: 'timestamptz', nullable: true },
    anuladoEn: { name: 'anulado_en', type: 'timestamptz', nullable: true },
  },
});
