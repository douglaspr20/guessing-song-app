import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { GOOGLE_STATE_COOKIE, exchangeGoogleCode, googleConfig, signInWithGoogle } from "@/lib/access/google";
import { readIdToken } from "@/lib/access/google-token";
import { clientInfo } from "@/lib/access/request";
import { currentUser, startSession } from "@/lib/access/session";
import { AppError } from "@/lib/errors";
import { requestOrigin } from "@/lib/request-origin";

/** Errores que la portada sabe explicar (`/?error=...`). */
const KNOWN_ERRORS: Record<string, string> = {
  GOOGLE_IN_USE: "google_in_use",
  ACCOUNT_DISABLED: "google_disabled",
  HOST_GOOGLE_FORBIDDEN: "google_host",
};

/** Google vuelve aquí con `code` y `state`. Siempre redirige a la portada. */
export async function GET(req: NextRequest) {
  const home = (params: Record<string, string> = {}) => {
    const url = new URL("/", requestOrigin(req));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  };

  const config = googleConfig();
  if (!config) return home({ error: "google_failed" });

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return home({ error: "google_denied" });

  let saved: { state?: string; nonce?: string; verifier?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "{}");
  } catch {
    saved = {};
  }
  const code = params.get("code");
  if (!code || !saved.state || !saved.nonce || !saved.verifier || params.get("state") !== saved.state) {
    return home({ error: "google_state" });
  }

  try {
    const idToken = await exchangeGoogleCode(code, saved.verifier);
    const profile = readIdToken(idToken, { clientId: config.clientId, nonce: saved.nonce });
    if (!profile) return home({ error: "google_failed" });

    const user = await currentUser();
    const result = await signInWithGoogle(profile, user?.id ?? null);
    // Al vincular ya hay sesión; al entrar se abre una nueva.
    if (!result.linked) await startSession(result.user.id, (await clientInfo()).userAgent);
    return home(result.linked ? { google: "linked" } : {});
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError && KNOWN_ERRORS[err.code]) return home({ error: KNOWN_ERRORS[err.code] });
    console.error("Fallo al entrar con Google", err);
    return home({ error: "google_failed" });
  }
}
