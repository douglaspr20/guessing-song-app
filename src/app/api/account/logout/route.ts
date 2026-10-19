import { endSession } from "@/lib/access/session";
import { handle } from "@/lib/errors";

/** Cierra la sesión de este navegador (miembro o anfitrión). */
export const POST = handle(async () => {
  await endSession();
  return new Response(null, { status: 204 });
});
