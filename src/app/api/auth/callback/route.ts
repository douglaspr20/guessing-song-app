import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { currentUser } from "@/lib/access/session";
import { AppError } from "@/lib/errors";
import { requestOrigin } from "@/lib/request-origin";
import { exchangeCode, linkSpotifyAccount, STATE_COOKIE } from "@/lib/spotify/auth";
import { getMeWithToken } from "@/lib/spotify/sources";

/** Errores de Spotify que la portada sabe explicar (`/?error=...`). */
const KNOWN_ERRORS: Record<string, string> = {
  SPOTIFY_NOT_ALLOWED: "not_allowed",
  SPOTIFY_IN_USE: "in_use",
};

/** Spotify vuelve aquí tras el login con `code` y `state`. Siempre redirige a la portada. */
export async function GET(req: NextRequest) {
  const home = (error?: string) => {
    // Vuelve al mismo origen por el que entró Spotify (donde está la sesión y las cookies).
    const url = new URL("/", requestOrigin(req));
    if (error) url.searchParams.set("error", error);
    const res = NextResponse.redirect(url);
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return home("denied");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || state !== req.cookies.get(STATE_COOKIE)?.value) return home("state");

  try {
    // La vinculación es para el usuario con sesión; sin sesión no se canjea nada.
    const user = await currentUser();
    if (!user) return home("session");
    const tokens = await exchangeCode(code);
    const profile = await getMeWithToken(tokens.access_token);
    await linkSpotifyAccount(user.id, tokens, profile);
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError && KNOWN_ERRORS[err.code]) return home(KNOWN_ERRORS[err.code]);
    console.error("Fallo al conectar con Spotify", err);
    return home("failed");
  }
  return home();
}
