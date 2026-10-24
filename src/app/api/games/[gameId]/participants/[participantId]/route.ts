import type { NextRequest } from "next/server";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { kickParticipant } from "@/lib/game/join";

/** El anfitrión echa a alguien de la partida. Sus puntos se quedan. */
export const DELETE = handle(
  async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/participants/[participantId]">) => {
    const { gameId, participantId } = await ctx.params;
    await requireGameOwner(gameId);
    await kickParticipant(gameId, participantId);
    return new Response(null, { status: 204 });
  },
);
