import { connection, type NextRequest } from "next/server";
import { assertGuestCanCreateGame } from "@/lib/access/limits";
import { currentOwner, requireOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { z } from "zod";
import { createGame, deleteAllGames, listGames } from "@/lib/game/service";

/** Estantería del usuario o invitado actual: sus últimas partidas con el podio. Query: ?limit=12 */
export const GET = handle(async (req: NextRequest) => {
  await connection(); // siempre en tiempo de petición (lee la BD)
  const owner = await currentOwner();
  if (!owner) return Response.json({ total: 0, games: [] });
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 12));
  return Response.json(await listGames(owner, limit));
});

/**
 * Crea una partida para el usuario o invitado actual.
 * Body: { mode?, players: string[], rounds: number, fragmentSeconds?: number (>= 60), filters?: GameFilters }
 */
export const POST = handle(async (req: Request) => {
  const owner = await requireOwner();
  if (owner.kind === "guest") await assertGuestCanCreateGame(owner.guestId);
  const game = await createGame(await req.json(), owner);
  return Response.json(game, { status: 201 });
});

const deleteAllSchema = z.object({ confirm: z.literal("BORRAR") });

/** Borra todo el historial del usuario o invitado actual. Body: { confirm: "BORRAR" } */
export const DELETE = handle(async (req: Request) => {
  const owner = await requireOwner();
  deleteAllSchema.parse(await req.json());
  return Response.json({ deleted: await deleteAllGames(owner) });
});
