import type { NextRequest } from "next/server";
import { handle } from "@/lib/errors";
import { buzz } from "@/lib/game/buzzer";
import { requireParticipant } from "@/lib/game/join";

/** «¡Lo sé!»: quien juega desde el móvil pide el turno. Solo uno lo consigue; la tele pausa la música. */
export const POST = handle(
  async (_req: NextRequest, ctx: RouteContext<"/api/play/[gameId]/rounds/[roundId]/buzz">) => {
    const { gameId, roundId } = await ctx.params;
    const me = await requireParticipant(gameId);
    return Response.json(await buzz(gameId, roundId, me));
  },
);
