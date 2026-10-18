import "server-only";
import { AppError } from "@/lib/errors";
import { getValidAccessToken } from "./auth";

const API_URL = "https://api.spotify.com/v1";
const MAX_RETRY_AFTER_S = 10;

type Query = Record<string, string | number | undefined>;

interface SpotifyRequest {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Query;
  body?: unknown;
}

/**
 * Llama a la Web API de Spotify con el token del anfitrión.
 * - 401: refresca el token y reintenta una vez.
 * - 429: espera lo que indique Retry-After (si es razonable) y reintenta una vez.
 */
export async function spotifyFetch<T>(path: string, req: SpotifyRequest = {}): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(req.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const send = async (forceRefresh: boolean) => {
    const token = await getValidAccessToken({ forceRefresh });
    return fetch(url, {
      method: req.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      cache: "no-store",
    });
  };

  let res = await send(false);

  if (res.status === 401) {
    res = await send(true);
  } else if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After") ?? "1");
    if (wait > MAX_RETRY_AFTER_S) {
      throw new AppError("Spotify está limitando las peticiones, prueba en un momento", 429, "SPOTIFY_RATE_LIMITED");
    }
    await new Promise((r) => setTimeout(r, wait * 1000));
    res = await send(false);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = await res.json();
      message = err?.error?.message ?? err?.error_description ?? message;
    } catch {
      // cuerpo vacío o no JSON
    }
    throw new AppError(`Spotify ${res.status}: ${message}`, res.status >= 500 ? 502 : res.status, "SPOTIFY_API_ERROR");
  }

  // 204 No Content (p. ej. play/pause)
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
