import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/errors";
import { getRoundGuesses, submitGuess } from "@/lib/game/service";

const bodySchema = z.object({
  playerId: z.string().min(1),
  title: z.string().max(200).optional(),
  artist: z.string().max(200).optional(),
});

type Ctx = RouteContext<"/api/games/[gameId]/rounds/[roundId]/guesses">;

/** Un jugador intenta adivinar. Body: { playerId, title?, artist? } (al menos uno). */
export const POST = handle(async (req: NextRequest, ctx: Ctx) => {
  const { gameId, roundId } = await ctx.params;
  const { playerId, title, artist } = bodySchema.parse(await req.json());
  return Response.json(await submitGuess(gameId, roundId, playerId, { title, artist }));
});

/** Intentos de la ronda. */
export const GET = handle(async (_req: NextRequest, ctx: Ctx) => {
  const { gameId, roundId } = await ctx.params;
  return Response.json({ guesses: await getRoundGuesses(gameId, roundId) });
});
