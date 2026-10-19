import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { addPlayer } from "@/lib/game/service";

const bodySchema = z.object({ name: z.string() });

/** Añade un jugador a la partida. Body: { name } */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/players">) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  const { name } = bodySchema.parse(await req.json());
  return Response.json(await addPlayer(gameId, name), { status: 201 });
});
