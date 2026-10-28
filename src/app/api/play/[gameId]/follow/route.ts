import type { NextRequest } from "next/server";
import { clientInfo } from "@/lib/access/request";
import { currentUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";
import { followNextGame } from "@/lib/game/join";

/** El móvil pasa a la partida que el anfitrión grabó con «Otra igual», con su mismo nombre y sitio. */
export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/play/[gameId]/follow">) => {
  const { gameId } = await ctx.params;
  const [{ ipHash }, user] = await Promise.all([clientInfo(), currentUser()]);
  const joined = await followNextGame(gameId, { ipHash, user: user ? { id: user.id, displayName: user.displayName } : null });
  return Response.json({ gameId: joined.gameId }, { status: 201 });
});
