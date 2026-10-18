import { connection } from "next/server";
import { handle } from "@/lib/errors";
import { getTokenExpiry, getValidAccessToken } from "@/lib/spotify/auth";

/** Token para el `getOAuthToken` del Web Playback SDK (se refresca solo en el servidor). */
export const GET = handle(async () => {
  await connection(); // siempre en tiempo de petición (lee la BD / Spotify)
  const accessToken = await getValidAccessToken();
  const expiresAt = await getTokenExpiry();
  return Response.json({ accessToken, expiresAt }, { headers: { "Cache-Control": "no-store" } });
});
