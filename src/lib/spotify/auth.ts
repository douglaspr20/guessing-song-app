import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/access/crypto";
import { AppError } from "@/lib/errors";

const ACCOUNTS_URL = "https://accounts.spotify.com";

/** Cookie que guarda el `state` del login para validarlo en el callback. */
export const STATE_COOKIE = "spotify_auth_state";

export const SPOTIFY_SCOPES = [
  "streaming", // Web Playback SDK
  "user-read-email",
  "user-read-private", // saber si la cuenta es Premium y su país
  "user-read-playback-state",
  "user-modify-playback-state", // iniciar/pausar en el dispositivo del navegador
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read", // "Canciones que te gustan"
].join(" ");

/** Margen para refrescar el token antes de que caduque. */
const EXPIRY_MARGIN_MS = 60_000;

function config() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError(
      "Faltan SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET o SPOTIFY_REDIRECT_URI en .env.local",
      500,
      "SPOTIFY_NOT_CONFIGURED",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${ACCOUNTS_URL}/authorize?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const { clientId, clientSecret } = config();
  const res = await fetch(`${ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new AppError(`Spotify rechazó el token: ${detail}`, 502, "SPOTIFY_TOKEN_ERROR");
  }
  return res.json();
}

/** Tokens recién canjeados, aún sin guardar (el callback comprueba la cuenta antes de vincularla). */
export type FreshTokens = TokenResponse;

/** Paso final del login: cambia el `code` del callback por tokens. */
export async function exchangeCode(code: string): Promise<FreshTokens> {
  const { redirectUri } = config();
  return requestToken(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }));
}

/**
 * Vincula la cuenta de Spotify al usuario (o renueva sus tokens). Una cuenta de Spotify solo puede
 * pertenecer a un usuario de la app. Los tokens se guardan cifrados.
 */
export async function linkSpotifyAccount(
  userId: string,
  tokens: FreshTokens,
  profile: { id: string; displayName: string | null },
) {
  if (!tokens.refresh_token) throw new AppError("Spotify no devolvió refresh token", 502, "SPOTIFY_TOKEN_ERROR");
  const owner = await db.spotifyAccount.findUnique({ where: { spotifyUserId: profile.id } });
  if (owner && owner.userId !== userId) {
    throw new AppError("Esa cuenta de Spotify ya está vinculada a otro usuario", 409, "SPOTIFY_IN_USE");
  }
  const data = {
    spotifyUserId: profile.id,
    displayName: profile.displayName,
    accessToken: encryptSecret(tokens.access_token),
    refreshToken: encryptSecret(tokens.refresh_token),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };
  await db.spotifyAccount.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

// Evita refrescos simultáneos del mismo usuario si llegan varias peticiones con el token caducado.
const refreshing = new Map<string, Promise<string>>();

async function refresh(userId: string, refreshToken: string): Promise<string> {
  const tokens = await requestToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
  await db.spotifyAccount.update({
    where: { userId },
    data: {
      accessToken: encryptSecret(tokens.access_token),
      // Spotify a veces rota el refresh token; si no manda uno nuevo, se conserva el anterior.
      ...(tokens.refresh_token ? { refreshToken: encryptSecret(tokens.refresh_token) } : {}),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
  return tokens.access_token;
}

const notLinked = () =>
  new AppError("Conecta primero tu cuenta de Spotify", 401, "SPOTIFY_NOT_CONNECTED");

/** Devuelve un access token válido del usuario, refrescándolo si hace falta. */
export async function getValidAccessToken(userId: string, options: { forceRefresh?: boolean } = {}): Promise<string> {
  const account = await db.spotifyAccount.findUnique({ where: { userId } });
  if (!account) throw notLinked();
  const fresh = account.expiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now();
  if (fresh && !options.forceRefresh) return decryptSecret(account.accessToken);

  let pending = refreshing.get(userId);
  if (!pending) {
    pending = refresh(userId, decryptSecret(account.refreshToken)).finally(() => refreshing.delete(userId));
    refreshing.set(userId, pending);
  }
  return pending;
}

export async function getSpotifyAccount(userId: string) {
  return db.spotifyAccount.findUnique({
    where: { userId },
    select: { spotifyUserId: true, displayName: true, expiresAt: true },
  });
}

/** Desvincula Spotify del usuario (no borra al usuario ni sus partidas). */
export async function disconnect(userId: string) {
  await db.spotifyAccount.deleteMany({ where: { userId } });
}
