import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { awardSpoken } from "@/lib/game/service";

const bodySchema = z.object({
  playerId: z.string().min(1),
  title: z.boolean().optional(),
  artist: z.boolean().optional(),
});

/** El anfitrión da por acertado lo que un jugador dijo de palabra. Body: { playerId, title?: true, artist?: true } */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds/[roundId]/award">) => {
  const { gameId, roundId } = await ctx.params;
  await requireGameOwner(gameId);
  const { playerId, ...parts } = bodySchema.parse(await req.json());
  return Response.json(await awardSpoken(gameId, roundId, playerId, parts));
});
