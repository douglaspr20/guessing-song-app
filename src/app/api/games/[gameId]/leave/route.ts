import type { NextRequest } from "next/server";
import { handle } from "@/lib/errors";
import { leaveGame } from "@/lib/game/join";

/** Quien se unió desde el móvil se sale antes de la primera pista (lo identifica su cookie de participante). */
export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/leave">) => {
  const { gameId } = await ctx.params;
  await leaveGame(gameId);
  return new Response(null, { status: 204 });
});
