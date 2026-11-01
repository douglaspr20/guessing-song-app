import { connection } from "next/server";
import { getAccessStatus } from "@/lib/access/status";
import { handle } from "@/lib/errors";

/** Quién está usando la app: usuario con sesión, invitado o nadie, y si tiene Spotify vinculado. */
export const GET = handle(async () => {
  await connection(); // siempre en tiempo de petición (lee cookies y BD)
  return Response.json(await getAccessStatus());
});
