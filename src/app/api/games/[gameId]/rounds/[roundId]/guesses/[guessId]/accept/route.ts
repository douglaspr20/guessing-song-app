import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/errors";
import { overrideGuess } from "@/lib/game/service";

const bodySchema = z.object({ title: z.boolean().optional(), artist: z.boolean().optional() });

/** El anfitrión da por bueno un intento. Body: { title?: true, artist?: true } */
export const POST = handle(
  async (req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/rounds/[roundId]/guesses/[guessId]/accept">) => {
    const { gameId, roundId, guessId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    return Response.json(await overrideGuess(gameId, roundId, guessId, body));
  },
);
