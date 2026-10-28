import type { NextRequest } from "next/server";
import { requireGameOwner } from "@/lib/access/owner";
import { localeFromRequest } from "@/i18n/locales";
import { handle } from "@/lib/errors";
import { shareAndDescribe, unshareGame } from "@/lib/game/share";

/** Crea (o devuelve) el enlace público del resultado de una partida terminada. En el idioma de quien comparte. */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/share">) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  return Response.json(await shareAndDescribe(gameId, localeFromRequest(req)), { status: 201 });
});

/** «Dejar de compartir»: el enlace y la imagen dejan de funcionar. Solo el dueño. */
export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/share">) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  await unshareGame(gameId);
  return new Response(null, { status: 204 });
});
