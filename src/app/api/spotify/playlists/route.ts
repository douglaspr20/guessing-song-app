import { connection } from "next/server";
import { handle } from "@/lib/errors";
import { getMyPlaylists } from "@/lib/spotify/sources";

/** Playlists del usuario conectado, para usarlas como fuente de canciones. */
export const GET = handle(async () => {
  await connection(); // siempre en tiempo de petición (lee la BD / Spotify)
  return Response.json({ playlists: await getMyPlaylists() });
});
