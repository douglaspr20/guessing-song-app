import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { leaveHostSeat, takeHostSeat } from "@/lib/game/join";

type Ctx = RouteContext<"/api/games/[gameId]/host-seat">;

const bodySchema = z.object({ name: z.string().trim().min(1).max(30) });

/** El anfitrión también juega con uno de los nombres de la partida (o cambia de nombre). Body: { name } */
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  const { name } = bodySchema.parse(await req.json());
  return Response.json(await takeHostSeat(gameId, name));
});

/** El anfitrión deja de jugar (solo antes de la primera ronda). */
export const DELETE = handle(async (_req: NextRequest, ctx: Ctx) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  await leaveHostSeat(gameId);
  return new Response(null, { status: 204 });
});
