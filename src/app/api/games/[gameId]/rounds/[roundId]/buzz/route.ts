import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { resolveBuzz } from "@/lib/game/buzzer";

const bodySchema = z.object({ mode: z.enum(["expire", "fail", "cancel"]) });

/**
 * El anfitrión cierra el turno de quien pulsó. Body: { mode }
 * — "expire": solo si ya se pasó de tiempo; "fail": lo da por fallado; "cancel": sin dejarle fuera.
 */
export const POST = handle(
  async (req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds/[roundId]/buzz">) => {
    const { gameId, roundId } = await ctx.params;
    await requireGameOwner(gameId);
    const { mode } = bodySchema.parse(await req.json());
    return Response.json(await resolveBuzz(gameId, roundId, mode));
  },
);
