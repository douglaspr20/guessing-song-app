import "server-only";
import { db } from "@/lib/db";
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

async function saveTokens(t: TokenResponse, previousRefreshToken?: string) {
  const refreshToken = t.refresh_token ?? previousRefreshToken;
  if (!refreshToken) throw new AppError("Spotify no devolvió refresh token", 502, "SPOTIFY_TOKEN_ERROR");
  const data = {
    accessToken: t.access_token,
    refreshToken,
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
  };
  return db.spotifyAuth.upsert({ where: { id: "default" }, create: data, update: data });
}

/** Paso final del login: cambia el `code` del callback por tokens y los guarda. */
export async function exchangeCode(code: string) {
  const { redirectUri } = config();
  const tokens = await requestToken(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
  await saveTokens(tokens);
}

// Evita refrescos simultáneos si varias peticiones llegan con el token caducado.
let refreshing: Promise<string> | null = null;

async function refresh(refreshToken: string): Promise<string> {
  const tokens = await requestToken(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
  const saved = await saveTokens(tokens, refreshToken);
  return saved.accessToken;
}

/** Devuelve un access token válido, refrescándolo si hace falta. */
export async function getValidAccessToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
  const auth = await db.spotifyAuth.findUnique({ where: { id: "default" } });
  if (!auth) {
    throw new AppError("Conecta primero tu cuenta de Spotify en /api/auth/login", 401, "SPOTIFY_NOT_CONNECTED");
  }
  const fresh = auth.expiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now();
  if (fresh && !options.forceRefresh) return auth.accessToken;

  refreshing ??= refresh(auth.refreshToken).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function getTokenExpiry(): Promise<Date | null> {
  const auth = await db.spotifyAuth.findUnique({ where: { id: "default" } });
  return auth?.expiresAt ?? null;
}

export async function disconnect() {
  await db.spotifyAuth.deleteMany();
}
