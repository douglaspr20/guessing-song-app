import type { NextRequest } from "next/server";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { listParticipants } from "@/lib/game/join";

/** Quién se ha unido desde su móvil (para la lista de la tele). */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/participants">) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  return Response.json({ participants: await listParticipants(gameId) });
});
