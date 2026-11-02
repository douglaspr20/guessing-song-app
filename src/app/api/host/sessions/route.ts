import { cookies } from "next/headers";
import { clearCookie, cookieName } from "@/lib/access/request";
import { requireHost, revokeSessions } from "@/lib/access/session";
import { handle } from "@/lib/errors";

/** «Cerrar todas las sesiones»: saca al anfitrión de todos sus dispositivos, incluido este. */
export const DELETE = handle(async () => {
  const host = await requireHost();
  const count = await revokeSessions(host.id);
  clearCookie(await cookies(), cookieName("session"));
  return Response.json({ revoked: count });
});
