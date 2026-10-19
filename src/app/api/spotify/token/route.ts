import { connection } from "next/server";
import { requireUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";
import { getSpotifyAccount, getValidAccessToken } from "@/lib/spotify/auth";

/** Token del propio usuario para el `getOAuthToken` del Web Playback SDK (se refresca en el servidor). */
export const GET = handle(async () => {
  await connection(); // siempre en tiempo de petición (lee la BD / Spotify)
  const user = await requireUser();
  const accessToken = await getValidAccessToken(user.id);
  const expiresAt = (await getSpotifyAccount(user.id))?.expiresAt ?? null;
  return Response.json({ accessToken, expiresAt }, { headers: { "Cache-Control": "no-store" } });
});
