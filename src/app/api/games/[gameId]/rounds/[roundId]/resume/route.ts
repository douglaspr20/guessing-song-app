import type { NextRequest } from "next/server";
import { handle } from "@/lib/errors";
import { resumeRound } from "@/lib/game/service";

/** Reanuda el reloj de la ronda tras una pausa. */
export const POST = handle(
  async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds/[roundId]/resume">) => {
    const { gameId, roundId } = await ctx.params;
    return Response.json(await resumeRound(gameId, roundId));
  },
);
