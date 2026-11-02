import "server-only";
import { headers } from "next/headers";
import { hashIp } from "./hash";

/** IP del cliente (Vercel rellena x-forwarded-for) como hash, y su navegador. */
export async function clientInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return { ipHash: hashIp(ip), userAgent: h.get("user-agent")?.slice(0, 200) ?? null };
}

/** En producción las cookies llevan el prefijo __Host- (solo HTTPS, sin dominio, path "/"). */
export function cookieName(base: string) {
  return process.env.NODE_ENV === "production" ? `__Host-${base}` : base;
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

type CookieJar = { set(name: string, value: string, options: ReturnType<typeof cookieOptions>): unknown };

/**
 * Borra una cookie. `cookies().delete()` la manda sin `Secure` ni `Path=/`, y el navegador rechaza esa orden para las
 * cookies `__Host-` de producción (la cookie se quedaba): hay que repetir los atributos con que se creó.
 */
export function clearCookie(jar: CookieJar, name: string) {
  jar.set(name, "", cookieOptions(0));
}
