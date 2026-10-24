import type { NextRequest } from "next/server";
import { handle } from "@/lib/errors";
import { isLockedOut } from "@/lib/game/buzzer";
import { requireParticipant } from "@/lib/game/join";
import { getGame } from "@/lib/game/service";

/** Lo que ve quien juega desde su móvil: la partida (sin ajustes internos) y quién es él. */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/play/[gameId]">) => {
  const { gameId } = await ctx.params;
  const me = await requireParticipant(gameId);
  const full = await getGame(gameId);
  const game = { ...full, filters: undefined, nextTrackReady: undefined };
  // Si ya falló en esta pista (él o su equipo), el botón se queda apagado hasta la siguiente.
  const lockedOut = full.round ? await isLockedOut(full.round.id, me) : false;
  return Response.json({
    game,
    me: { id: me.id, name: me.name, playerId: me.playerId, memberId: me.memberId, lockedOut },
  });
});
