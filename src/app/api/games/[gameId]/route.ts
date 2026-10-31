import type { NextRequest } from "next/server";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { isLockedOut } from "@/lib/game/buzzer";
import { currentParticipant, setJoinOpen } from "@/lib/game/join";
import { deleteGame, getGame, updateFilters } from "@/lib/game/service";

type Ctx = RouteContext<"/api/games/[gameId]">;

/**
 * Estado de la partida: jugadores, marcador, ronda actual e historial. Si el anfitrión también juega desde este
 * navegador, `hostSeat` dice con qué nombre y si ya falló en la ronda en curso.
 */
export const GET = handle(async (_req: NextRequest, ctx: Ctx) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  const game = await getGame(gameId);
  const me = await currentParticipant(gameId);
  const hostSeat = me?.isHost
    ? {
        id: me.id,
        name: me.name,
        playerId: me.playerId,
        memberId: me.memberId,
        lockedOut: game.round ? await isLockedOut(game.round.id, me) : false,
      }
    : null;
  return Response.json({ ...game, hostSeat });
});

/** Cambia los filtros entre rondas (Body: { filters }) o abre/cierra la entrada (Body: { joinOpen }). */
export const PATCH = handle(async (req: NextRequest, ctx: Ctx) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  const body = await req.json();
  if (typeof body?.joinOpen === "boolean") {
    await setJoinOpen(gameId, body.joinOpen);
    return Response.json(await getGame(gameId));
  }
  return Response.json(await updateFilters(gameId, body?.filters));
});

/** Borra la partida (al editar una partida sin empezar se graba una nueva y se borra esta). */
export const DELETE = handle(async (_req: NextRequest, ctx: Ctx) => {
  const { gameId } = await ctx.params;
  await requireGameOwner(gameId);
  await deleteGame(gameId);
  return new Response(null, { status: 204 });
});
