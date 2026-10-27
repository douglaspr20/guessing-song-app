import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

export const LOGIN_LIMITS = {
  /** Fallos por IP dentro de la ventana antes de responder 429. */
  perIp: 5,
  perIpWindowMs: 15 * 60_000,
  /** Fallos sumando todas las IP: frena ataques repartidos entre muchas direcciones. */
  global: 20,
  globalWindowMs: 60 * 60_000,
};

const tooMany = () =>
  new AppError("TOO_MANY_ATTEMPTS", 429);

/** Lanza 429 si esta IP (o el total) acumula demasiados fallos recientes. */
export async function assertLoginAllowed(ipHash: string, now = new Date()) {
  const [byIp, total] = await Promise.all([
    db.loginAttempt.count({
      where: { ipHash, ok: false, createdAt: { gt: new Date(now.getTime() - LOGIN_LIMITS.perIpWindowMs) } },
    }),
    db.loginAttempt.count({
      where: { ok: false, createdAt: { gt: new Date(now.getTime() - LOGIN_LIMITS.globalWindowMs) } },
    }),
  ]);
  if (byIp >= LOGIN_LIMITS.perIp || total >= LOGIN_LIMITS.global) throw tooMany();
}

export async function recordLoginAttempt(ipHash: string, ok: boolean) {
  await db.loginAttempt.create({ data: { ipHash, ok } });
}

/** Mensaje único para cualquier fallo de credenciales: no dice qué parte falló. */
export const invalidCredentials = () =>
  new AppError("INVALID_CREDENTIALS", 401);
