import type { NextRequest } from "next/server";
import { handle } from "@/lib/errors";
import { pauseRound } from "@/lib/game/service";

/** Congela el reloj de la ronda (puntos y pistas). */
export const POST = handle(
  async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds/[roundId]/pause">) => {
    const { gameId, roundId } = await ctx.params;
    return Response.json(await pauseRound(gameId, roundId));
  },
);
