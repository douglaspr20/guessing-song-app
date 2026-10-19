import { requireUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";
import { disconnect } from "@/lib/spotify/auth";

/** Desvincula el Spotify del usuario (no cierra su sesión en la app). */
export const POST = handle(async () => {
  const user = await requireUser();
  await disconnect(user.id);
  return Response.json({ linked: false });
});
