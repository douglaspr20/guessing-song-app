import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { normalizeInviteCode } from "./invites";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import { assertLoginAllowed, invalidCredentials, recordLoginAttempt } from "./throttle";
import { sha256 } from "./hash";

/** Tras estos fallos seguidos, la cuenta queda bloqueada un rato (además del límite por IP). */
export const MEMBER_LOCK = { failures: 5, lockMs: 15 * 60_000 };

const RESERVED_USERNAMES = new Set(["anfitrion", "anfitrión", "host", "admin", "root"]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,30}$/, "USERNAME_FORMAT");

export const passwordSchema = z
  .string()
  .min(8, "PASSWORD_TOO_SHORT")
  .max(200, "PASSWORD_TOO_LONG");

export const registerSchema = z.object({
  invite: z.string().min(1, "INVITE_REQUIRED"),
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, "DISPLAY_NAME_INVALID").max(40, "DISPLAY_NAME_INVALID").optional(),
});

const badInvite = () => new AppError("INVALID_INVITE", 422);

/** Alta de un miembro con un código de invitación de un solo uso. */
export async function registerMember(input: z.input<typeof registerSchema>, now = new Date()) {
  const data = registerSchema.parse(input);
  const taken = () => new AppError("USERNAME_TAKEN", 409);
  if (RESERVED_USERNAMES.has(data.username)) throw taken();
  const passwordHash = await hashPassword(data.password);
  const codeHash = sha256(normalizeInviteCode(data.invite));

  try {
    return await db.$transaction(async (tx) => {
      // Reclama la invitación de forma atómica: si dos personas la usan a la vez, solo una gana.
      const claimed = await tx.invite.updateMany({
        where: { codeHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (!claimed.count) throw badInvite();
      if (await tx.user.findUnique({ where: { username: data.username } })) throw taken();
      const user = await tx.user.create({
        data: {
          username: data.username,
          passwordHash,
          displayName: data.displayName ?? data.username,
          role: "member",
          spotifyAllowed: true,
        },
      });
      await tx.invite.update({ where: { codeHash }, data: { usedByUserId: user.id } });
      return user;
    });
  } catch (err) {
    // Dos altas con el mismo nombre a la vez: la restricción única decide (y la invitación no se gasta).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw taken();
    throw err;
  }
}

/** Una cuenta que ya existe (p. ej. gratis con Google) canjea una invitación: gana el modo Spotify. */
export async function redeemInvite(userId: string, rawCode: string, now = new Date()) {
  const codeHash = sha256(normalizeInviteCode(rawCode));
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.spotifyAllowed || user.role === "host") {
      throw new AppError("ALREADY_INVITED", 409);
    }
    const claimed = await tx.invite.updateMany({
      where: { codeHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now, usedByUserId: userId },
    });
    if (!claimed.count) throw badInvite();
    return tx.user.update({ where: { id: userId }, data: { spotifyAllowed: true } });
  });
}

/**
 * Login de un miembro. Cualquier fallo (usuario inexistente, contraseña errónea, cuenta bloqueada
 * o desactivada) da el mismo error y tarda lo mismo.
 */
export async function authenticateMember(rawUsername: string, password: string, ipHash: string, now = new Date()) {
  await assertLoginAllowed(ipHash, now);
  const username = rawUsername.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { username } });

  const usable = user?.role === "member" && user.passwordHash && !user.disabledAt;
  const locked = !!user?.lockedUntil && user.lockedUntil > now;
  const ok = usable && !locked ? await verifyPassword(password, user.passwordHash!) : await burnPasswordCheck(password);

  await recordLoginAttempt(ipHash, ok);
  if (!ok) {
    if (user && usable && !locked) {
      const failures = user.failedLogins + 1;
      await db.user.update({
        where: { id: user.id },
        data:
          failures >= MEMBER_LOCK.failures
            ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + MEMBER_LOCK.lockMs) }
            : { failedLogins: failures },
      });
    }
    throw invalidCredentials();
  }
  await db.user.update({ where: { id: user!.id }, data: { failedLogins: 0, lockedUntil: null } });
  return user!;
}
