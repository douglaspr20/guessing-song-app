import { connection } from "next/server";
import { handle } from "@/lib/errors";
import { getTokenExpiry } from "@/lib/spotify/auth";
import { getMe } from "@/lib/spotify/sources";

/** ¿Hay una cuenta de Spotify conectada? ¿Es Premium? */
export const GET = handle(async () => {
  await connection(); // siempre en tiempo de petición (lee la BD / Spotify)
  if (!(await getTokenExpiry())) return Response.json({ connected: false });
  const profile = await getMe();
  return Response.json({ connected: true, profile });
});
