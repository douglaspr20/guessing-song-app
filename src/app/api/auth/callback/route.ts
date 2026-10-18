import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requestOrigin } from "@/lib/request-origin";
import { exchangeCode, STATE_COOKIE } from "@/lib/spotify/auth";

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
    await exchangeCode(code);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Fallo al conectar con Spotify", err);
    return home("failed");
  }
  return home();
}
