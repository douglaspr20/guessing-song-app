import type { NextRequest } from "next/server";
import { localeFromRequest } from "@/i18n/locales";
import { handle } from "@/lib/errors";
import { requireParticipant } from "@/lib/game/join";
import { shareAndDescribe } from "@/lib/game/share";

/** Un móvil unido a la partida comparte su resultado: crea (o devuelve) el mismo enlace que la tele. No puede retirarlo. */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/play/[gameId]/share">) => {
  const { gameId } = await ctx.params;
  await requireParticipant(gameId);
  return Response.json(await shareAndDescribe(gameId, localeFromRequest(req)), { status: 201 });
});
