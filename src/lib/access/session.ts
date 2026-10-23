import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { randomToken, sha256 } from "./hash";
import { cookieName, cookieOptions } from "./request";

const SESSION_COOKIE = () => cookieName("sesion");
export const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;
/** Cada cuánto se actualiza `lastSeenAt` (evita escribir en cada petición). */
const TOUCH_EVERY_MS = 60 * 60_000;

export type Role = "host" | "member";

export interface SessionUser {
  id: string;
  role: Role;
  username: string;
  displayName: string;
  /** Puede usar el modo Spotify (invitación o anfitrión). */
  spotifyAllowed: boolean;
}

/** Quien no tiene permiso recibe un 404: así no se sabe ni que la ruta existe. */
export const notFound = () => new AppError("No encontrado", 404, "NOT_FOUND");

/** Crea la sesión en la base de datos (solo guarda el hash del token) y devuelve el token. */
export async function openSession(userId: string, userAgent: string | null) {
  const token = randomToken();
  await db.session.create({
    data: { id: sha256(token), userId, userAgent, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

/** Inicia sesión y deja la cookie en la respuesta (solo en route handlers). */
export async function startSession(userId: string, userAgent: string | null) {
  const token = await openSession(userId, userAgent);
  (await cookies()).set(SESSION_COOKIE(), token, cookieOptions(SESSION_TTL_MS / 1000));
}

/** Usuario de la sesión de un token, o null si no existe, caducó o el usuario está desactivado. */
export async function userForSessionToken(token: string, now = new Date()): Promise<SessionUser | null> {
  const session = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt <= now || session.user.disabledAt) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  const { id, role, username, displayName, spotifyAllowed } = session.user;
  return { id, role: role as Role, username, displayName, spotifyAllowed: role === "host" || spotifyAllowed };
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE())?.value;
  return token ? userForSessionToken(token) : null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw notFound();
  return user;
}

export async function requireHost(): Promise<SessionUser> {
  const user = await currentUser();
  if (user?.role !== "host") throw notFound();
  return user;
}

/** Cierra la sesión de este navegador. */
export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE())?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  store.delete(SESSION_COOKIE());
}

/** Cierra todas las sesiones de un usuario (en todos sus dispositivos). */
export async function revokeSessions(userId: string) {
  const { count } = await db.session.deleteMany({ where: { userId } });
  return count;
}
