import { ensureGuest, forgetGuest } from "@/lib/access/guest";
import { assertOpenModeAvailable } from "@/lib/access/limits";
import { handle } from "@/lib/errors";

/** «Jugar sin cuenta»: crea (o reutiliza) el invitado anónimo de este navegador. */
export const POST = handle(async () => {
  await assertOpenModeAvailable();
  await ensureGuest();
  return Response.json({ guest: true }, { status: 201 });
});

/** «Volver al inicio»: este navegador deja de ser ese invitado. */
export const DELETE = handle(async () => {
  await forgetGuest();
  return new Response(null, { status: 204 });
});
