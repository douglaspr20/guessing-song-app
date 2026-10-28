import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { randomToken, sha256 } from "./hash";
import { GUEST_LIMITS } from "./limits";
import { clientInfo, cookieName, cookieOptions } from "./request";
import { getAppState } from "./state";

const GUEST_COOKIE = () => cookieName("guest");
const GUEST_TTL_SECONDS = 365 * 24 * 60 * 60;
const TOUCH_EVERY_MS = 60 * 60_000;

export const guestBlocked = () => new AppError("GUEST_BLOCKED", 403);

/** Da de alta un invitado nuevo respetando los límites. Devuelve el token para la cookie. */
export async function registerGuest(ipHash: string, now = new Date()) {
  const state = await getAppState();
  if (state.guestSignupsPaused) {
    throw new AppError("GUEST_SIGNUPS_PAUSED", 503);
  }
  if (await db.blockedIp.findUnique({ where: { ipHash } })) throw guestBlocked();
  const today = await db.guest.count({
    where: { ipHash, createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60_000) } },
  });
  if (today >= GUEST_LIMITS.guestsPerIpPerDay) {
    throw new AppError("GUEST_LIMIT", 429);
  }
  const token = randomToken();
  const guest = await db.guest.create({ data: { id: sha256(token), ipHash } });
  return { token, guest };
}

/** Invitado de un token. Si el anfitrión lo bloqueó, lanza 403; si se borró, null. */
export async function guestForToken(token: string, now = new Date()) {
  const guest = await db.guest.findUnique({ where: { id: sha256(token) } });
  if (!guest) return null;
  if (guest.blockedAt) throw guestBlocked();
  if (now.getTime() - guest.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.guest.update({ where: { id: guest.id }, data: { lastSeenAt: now } });
  }
  return guest;
}

export async function currentGuest() {
  const token = (await cookies()).get(GUEST_COOKIE())?.value;
  return token ? guestForToken(token) : null;
}

/** «Jugar sin cuenta»: reutiliza el invitado de este navegador o crea uno nuevo. */
export async function ensureGuest() {
  const existing = await currentGuest();
  if (existing) return existing;
  const { ipHash } = await clientInfo();
  const { token, guest } = await registerGuest(ipHash);
  (await cookies()).set(GUEST_COOKIE(), token, cookieOptions(GUEST_TTL_SECONDS));
  return guest;
}

/** Olvida el invitado en este navegador (sus partidas las borra la limpieza cuando caduquen). */
export async function forgetGuest() {
  (await cookies()).delete(GUEST_COOKIE());
}
