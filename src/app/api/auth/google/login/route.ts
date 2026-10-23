import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, buildGoogleAuthUrl, googleConfig } from "@/lib/access/google";
import { pkcePair } from "@/lib/access/google-token";
import { randomToken } from "@/lib/access/hash";
import { notFound } from "@/lib/access/session";
import { handle } from "@/lib/errors";
import { requestOrigin } from "@/lib/request-origin";

/** Redirige a Google para entrar (o, con sesión, para vincular el Google a la cuenta). */
export const GET = handle(async (req: NextRequest) => {
  const config = googleConfig();
  if (!config) throw notFound();

  // La cookie del intento solo vuelve si empieza en el mismo origen al que Google devuelve.
  const target = new URL(config.redirectUri).origin;
  if (requestOrigin(req) !== target) return NextResponse.redirect(new URL("/api/auth/google/login", target));

  const state = randomToken(16);
  const nonce = randomToken(16);
  const { verifier, challenge } = pkcePair();
  const res = NextResponse.redirect(buildGoogleAuthUrl({ state, challenge, nonce }));
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, nonce, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
});
