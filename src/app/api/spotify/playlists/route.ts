import { connection } from "next/server";
import { requireUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";
import { getMyPlaylists } from "@/lib/spotify/sources";

/** Playlists del usuario, para usarlas como fuente de canciones. */
export const GET = handle(async () => {
  await connection(); // siempre en tiempo de petición (lee la BD / Spotify)
  const user = await requireUser();
  return Response.json({ playlists: await getMyPlaylists(user.id) });
});
