import type { NextRequest } from "next/server";
import { assertOwnerCanCreateGame } from "@/lib/access/limits";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { replayGame } from "@/lib/game/service";

/** «Otra igual»: graba una partida nueva con los mismos ajustes y personas que esta (ya terminada). */
export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/replay">) => {
  const { gameId } = await ctx.params;
  const owner = await requireGameOwner(gameId);
  await assertOwnerCanCreateGame(owner);
  return Response.json(await replayGame(gameId, owner), { status: 201 });
});
