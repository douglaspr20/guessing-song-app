import { handle } from "@/lib/errors";
import { disconnect } from "@/lib/spotify/auth";

/** Olvida los tokens de Spotify guardados. */
export const POST = handle(async () => {
  await disconnect();
  return Response.json({ connected: false });
});
