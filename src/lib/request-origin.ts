import type { NextRequest } from "next/server";

/**
 * Origen que escribió el usuario en el navegador. `req.nextUrl.origin` no sirve: en desarrollo
 * Next lo normaliza a "localhost" aunque se haya entrado por "127.0.0.1".
 */
export function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
