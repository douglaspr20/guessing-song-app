import type { NextRequest } from "next/server";
import { assertOwnerCanCreateGame } from "@/lib/access/limits";
import { requireGameOwner } from "@/lib/access/owner";
import { AppError, handle } from "@/lib/errors";
import { currentParticipant, takeHostSeat } from "@/lib/game/join";
import { replayGame } from "@/lib/game/service";

/**
 * «Otra igual»: graba una partida nueva con los mismos ajustes y personas que esta (ya terminada). Si el anfitrión
 * jugaba desde este navegador, en la nueva sigue jugando con el mismo nombre.
 */
export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/replay">) => {
  const { gameId } = await ctx.params;
  const owner = await requireGameOwner(gameId);
  await assertOwnerCanCreateGame(owner);
  const me = await currentParticipant(gameId);
  const next = await replayGame(gameId, owner);
  if (me?.isHost) {
    try {
      await takeHostSeat(next.id, me.name);
    } catch (err) {
      // Si la otra ya había empezado (doble clic tardío), se queda como está.
      if (!(err instanceof AppError) || err.code !== "GAME_ALREADY_STARTED") throw err;
    }
  }
  return Response.json(next, { status: 201 });
});
