import type { NextRequest } from "next/server";
import { handle } from "@/lib/errors";
import { requireParticipant } from "@/lib/game/join";
import { getGame } from "@/lib/game/service";

/** Lo que ve quien juega desde su móvil: la partida (sin ajustes internos) y quién es él. */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/play/[gameId]">) => {
  const { gameId } = await ctx.params;
  const me = await requireParticipant(gameId);
  const game = { ...(await getGame(gameId)), filters: undefined, nextTrackReady: undefined };
  return Response.json({
    game,
    me: { id: me.id, name: me.name, playerId: me.playerId, memberId: me.memberId },
  });
});
