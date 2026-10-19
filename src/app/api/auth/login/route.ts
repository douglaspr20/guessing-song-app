import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";
import { requestOrigin } from "@/lib/request-origin";
import { buildAuthorizeUrl, STATE_COOKIE } from "@/lib/spotify/auth";

/** Redirige al login de Spotify para vincular la cuenta al usuario con sesión. */
export const GET = handle(async (req: NextRequest) => {
  // La cookie del `state` solo vuelve si el login empieza en el mismo origen al que Spotify
  // devuelve (SPOTIFY_REDIRECT_URI). Si se abrió la app en "localhost" y la redirección es a
  // "127.0.0.1", son sitios distintos para el navegador: primero saltamos al origen correcto.
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (redirectUri) {
    const target = new URL(redirectUri).origin;
    if (requestOrigin(req) !== target) {
      return NextResponse.redirect(new URL("/api/auth/login", target));
    }
  }

  // Solo quien tiene sesión puede vincular un Spotify (y solo al suyo).
  await requireUser();

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
});
