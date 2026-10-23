import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { passwordSchema } from "./accounts";
import { hashPassword, verifyPassword } from "./password";
import { assertLoginAllowed, recordLoginAttempt } from "./throttle";

// Sin 0/O ni 1/I/L: la contraseña temporal se dicta o se copia a mano.
const TEMP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Contraseña temporal legible, p. ej. «K7MP-Q2XA-9RTW» (12 caracteres al azar, ~59 bits). */
export function temporaryPassword() {
  const raw = Array.from({ length: 12 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");
  return raw.match(/.{4}/g)!.join("-");
}

/** El anfitrión no cambia su contraseña desde la app: se responde como si la acción no existiera. */
const notAvailable = () => new AppError("No encontrado", 404, "NOT_FOUND");

/**
 * Un miembro cambia su contraseña (o pone una, si hasta ahora solo entraba con Google).
 * Con contraseña previa exige la actual; los fallos cuentan para el límite por IP. Al cambiarla se
 * cierran sus otras sesiones (la de este navegador sigue abierta).
 */
export async function changePassword(
  userId: string,
  input: { current?: string; next: string },
  { ipHash, keepSessionId }: { ipHash: string; keepSessionId: string | null },
) {
  const next = passwordSchema.parse(input.next);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "host") throw notAvailable();

  if (user.passwordHash) {
    await assertLoginAllowed(ipHash);
    const ok = !!input.current && (await verifyPassword(input.current, user.passwordHash));
    if (!ok) {
      await recordLoginAttempt(ipHash, false);
      throw new AppError("La contraseña actual no es correcta", 401, "WRONG_PASSWORD");
    }
    if (input.current === next) {
      throw new AppError("La nueva contraseña tiene que ser distinta de la actual", 422, "SAME_PASSWORD");
    }
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false, failedLogins: 0, lockedUntil: null },
  });
  const { count } = await db.session.deleteMany({
    where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
  });
  return { closedSessions: count };
}

/**
 * El anfitrión restablece la contraseña de un miembro que la olvidó: genera una temporal (que solo
 * se muestra esta vez), cierra todas sus sesiones y le pedirá ponerse una suya al entrar.
 */
export async function resetMemberPassword(memberId: string) {
  const user = await db.user.findUnique({ where: { id: memberId } });
  if (!user || user.role !== "member") throw new AppError("Miembro no encontrado", 404, "MEMBER_NOT_FOUND");
  const password = temporaryPassword();
  await db.user.update({
    where: { id: memberId },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null },
  });
  await db.session.deleteMany({ where: { userId: memberId } });
  return { password, username: user.username };
}
