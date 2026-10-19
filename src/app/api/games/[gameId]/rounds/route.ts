import type { NextRequest } from "next/server";
import { assertGuestCanStartRound } from "@/lib/access/limits";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { startNextRound } from "@/lib/game/service";

/** Empieza la siguiente ronda (elige canción). No devuelve el título hasta que se cierre. */
export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds">) => {
  const { gameId } = await ctx.params;
  const owner = await requireGameOwner(gameId);
  if (owner.kind === "guest") await assertGuestCanStartRound(owner.guestId);
  return Response.json(await startNextRound(gameId), { status: 201 });
});
