import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { usernameFromEmail, type GoogleProfile } from "./google-token";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Cookie con el `state`, el verificador PKCE y el `nonce` de este intento (10 minutos). */
export const GOOGLE_STATE_COOKIE = "google_auth_state";

/** Configuración de Google, o null si falta: entonces el botón no se muestra. */
export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : null;
}

function requireConfig() {
  const config = googleConfig();
  if (!config) throw new AppError("NOT_FOUND", 404, { key: "GOOGLE_NOT_CONFIGURED" });
  return config;
}

export function buildGoogleAuthUrl({ state, challenge, nonce }: { state: string; challenge: string; nonce: string }) {
  const { clientId, redirectUri } = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

/** Canjea el código del callback por el id_token. */
export async function exchangeGoogleCode(code: string, verifier: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = requireConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new AppError("GOOGLE_TOKEN_ERROR", 502, { detail: `código rechazado: ${res.status}` });
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new AppError("GOOGLE_TOKEN_ERROR", 502);
  return data.id_token;
}

const inUse = () => new AppError("GOOGLE_IN_USE", 409);
// El anfitrión entra siempre con contraseña y código: un Google no puede saltarse el segundo factor.
const hostOnly = () =>
  new AppError("HOST_GOOGLE_FORBIDDEN", 403);
const disabled = () => new AppError("ACCOUNT_DISABLED", 403);

/** Un nombre de usuario libre a partir del correo (con sufijo numérico si ya existe). */
async function freeUsername(email: string) {
  const base = usernameFromEmail(email);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 24)}${randomInt(10, 9999)}`;
    if (!(await db.user.findUnique({ where: { username: candidate } }))) return candidate;
  }
  return `${base.slice(0, 20)}${Date.now().toString(36)}`;
}

/**
 * Entrar con Google:
 * - con sesión, vincula ese Google al usuario actual;
 * - sin sesión, entra con la cuenta que ya tenía ese Google o crea una cuenta gratis
 *   (modo sin cuenta con historial propio; el modo Spotify llega con una invitación).
 * Nunca une cuentas por coincidir el correo.
 */
export async function signInWithGoogle(profile: GoogleProfile, currentUserId: string | null) {
  const existing = await db.googleAccount.findUnique({ where: { googleSub: profile.sub }, include: { user: true } });

  if (currentUserId) {
    if (existing && existing.userId !== currentUserId) throw inUse();
    const user = await db.user.findUniqueOrThrow({ where: { id: currentUserId } });
    if (user.role === "host") throw hostOnly();
    if (user.disabledAt) throw disabled();
    await db.googleAccount.upsert({
      where: { userId: currentUserId },
      create: { userId: currentUserId, googleSub: profile.sub, email: profile.email },
      update: { googleSub: profile.sub, email: profile.email },
    });
    return { user, created: false, linked: true };
  }

  if (existing) {
    if (existing.user.role === "host") throw hostOnly();
    if (existing.user.disabledAt) throw disabled();
    if (existing.email !== profile.email) {
      await db.googleAccount.update({ where: { id: existing.id }, data: { email: profile.email } });
    }
    return { user: existing.user, created: false, linked: false };
  }

  try {
    const user = await db.user.create({
      data: {
        username: await freeUsername(profile.email),
        displayName: (profile.name ?? profile.email.split("@")[0]).slice(0, 40),
        role: "member",
        spotifyAllowed: false,
        google: { create: { googleSub: profile.sub, email: profile.email } },
      },
    });
    return { user, created: true, linked: false };
  } catch (err) {
    // Dos callbacks a la vez con el mismo Google: gana el primero y el otro entra con esa cuenta.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await db.googleAccount.findUnique({ where: { googleSub: profile.sub }, include: { user: true } });
      if (again) return { user: again.user, created: false, linked: false };
    }
    throw err;
  }
}

/** Quita el Google de una cuenta que tiene contraseña (si no, se quedaría sin forma de entrar). */
export async function unlinkGoogle(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) {
    throw new AppError("GOOGLE_ONLY_LOGIN", 409);
  }
  await db.googleAccount.deleteMany({ where: { userId } });
}
