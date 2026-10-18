import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/errors";
import { playRound } from "@/lib/game/service";

// `deviceId` solo hace falta en modo Spotify; en modo abierto suena el <audio> del navegador.
const bodySchema = z.object({ deviceId: z.string().min(1).optional(), offsetMs: z.number().min(0).optional() });

/**
 * Hace sonar el fragmento (Spotify: en el dispositivo del Web Playback SDK; abierto: devuelve `audioUrl`).
 * Body: { deviceId?, offsetMs? } — offsetMs retoma el fragmento a medias.
 */
export const POST = handle(
  async (req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds/[roundId]/play">) => {
    const { gameId, roundId } = await ctx.params;
    const { deviceId, offsetMs } = bodySchema.parse(await req.json());
    return Response.json(await playRound(gameId, roundId, deviceId, offsetMs));
  },
);
