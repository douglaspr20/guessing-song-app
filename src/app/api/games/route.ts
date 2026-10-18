import { connection, type NextRequest } from "next/server";
import { handle } from "@/lib/errors";
import { createGame, listGames } from "@/lib/game/service";

/** Historial: últimas partidas con su podio. Query: ?limit=12 */
export const GET = handle(async (req: NextRequest) => {
  await connection(); // siempre en tiempo de petición (lee la BD)
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 12));
  return Response.json(await listGames(limit));
});

/**
 * Crea una partida.
 * Body: { players: string[], rounds: number, fragmentSeconds?: number (>= 60), filters?: GameFilters }
 */
export const POST = handle(async (req: Request) => {
  const game = await createGame(await req.json());
  return Response.json(game, { status: 201 });
});
