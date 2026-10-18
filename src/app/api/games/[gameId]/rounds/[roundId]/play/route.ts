import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/errors";
import { playRound } from "@/lib/game/service";

const bodySchema = z.object({ deviceId: z.string().min(1) });

/** Reproduce el fragmento en el dispositivo del Web Playback SDK. Body: { deviceId } */
export const POST = handle(
  async (req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds/[roundId]/play">) => {
    const { gameId, roundId } = await ctx.params;
    const { deviceId } = bodySchema.parse(await req.json());
    return Response.json(await playRound(gameId, roundId, deviceId));
  },
);
