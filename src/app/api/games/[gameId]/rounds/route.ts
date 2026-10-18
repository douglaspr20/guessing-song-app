import type { NextRequest } from "next/server";
import { handle } from "@/lib/errors";
import { startNextRound } from "@/lib/game/service";

/** Empieza la siguiente ronda (elige canción). No devuelve el título hasta que se cierre. */
export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds">) => {
  const { gameId } = await ctx.params;
  return Response.json(await startNextRound(gameId), { status: 201 });
});
