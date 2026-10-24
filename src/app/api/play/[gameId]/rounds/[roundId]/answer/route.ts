import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/errors";
import { answer } from "@/lib/game/buzzer";
import { requireParticipant } from "@/lib/game/join";

const bodySchema = z.object({
  title: z.string().max(200).optional(),
  artist: z.string().max(200).optional(),
});

/** La respuesta de quien tiene el turno. Body: { title?, artist? } (puede ir vacía si se le acabó el tiempo). */
export const POST = handle(
  async (req: NextRequest, ctx: RouteContext<"/api/play/[gameId]/rounds/[roundId]/answer">) => {
    const { gameId, roundId } = await ctx.params;
    const me = await requireParticipant(gameId);
    const body = bodySchema.parse(await req.json());
    return Response.json(await answer(gameId, roundId, me, body));
  },
);
