import type { NextRequest } from "next/server";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { revealRound } from "@/lib/game/service";

/** Cierra la ronda sin ganador y desvela la canción. */
export const POST = handle(
  async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds/[roundId]/reveal">) => {
    const { gameId, roundId } = await ctx.params;
    await requireGameOwner(gameId);
    return Response.json(await revealRound(gameId, roundId));
  },
);
