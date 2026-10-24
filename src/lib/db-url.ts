/**
 * `pg` avisa de que `sslmode=prefer|require|verify-ca` pasarán a verificar menos en su próxima versión mayor.
 * La URL que pone la integración de Neon en Vercel no se puede editar, así que se pide aquí lo que hoy ya hace
 * (`verify-full`): el comportamiento no cambia y desaparece el aviso.
 */
export function withVerifyFull(connectionString: string) {
  return connectionString.replace(
    /([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|$)/,
    "$1verify-full",
  );
}
