import type { NextRequest } from "next/server";
import { currentOwner, assertOwnsGame } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { notFound } from "@/lib/access/session";
import { currentParticipant } from "@/lib/game/join";
import { createGameToken, realtimeEnabled } from "@/lib/realtime/ably";

/**
 * Token de Ably con permiso solo para escuchar el canal de una partida. Lo pide el dueño de la
 * partida (la tele) o un participante con su cookie; cualquier otro recibe un 404.
 * Sin Ably configurado responde `{ enabled: false }` y el cliente consulta cada pocos segundos.
 */
export const GET = handle(async (req: NextRequest) => {
  const gameId = req.nextUrl.searchParams.get("game");
  if (!gameId) throw notFound();

  let clientId: string | null = null;
  const owner = await currentOwner();
  if (owner) {
    try {
      await assertOwnsGame(owner, gameId);
      clientId = "host";
    } catch {
      clientId = null;
    }
  }
  if (!clientId) {
    const participant = await currentParticipant(gameId);
    if (participant) clientId = `p-${participant.id}`;
  }
  if (!clientId) throw notFound();

  if (!realtimeEnabled()) return Response.json({ enabled: false });
  return Response.json({ enabled: true, tokenRequest: await createGameToken(gameId, clientId) });
});
