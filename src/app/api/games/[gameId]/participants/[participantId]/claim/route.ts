import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireGameOwner } from "@/lib/access/owner";
import { handle } from "@/lib/errors";
import { resolveClaim } from "@/lib/game/join";

const bodySchema = z.object({ accept: z.boolean() });

/** El anfitrión deja entrar (el sitio pasa al navegador nuevo y el viejo sale) o rechaza la petición de recuperar un sitio. */
export const POST = handle(
  async (req: NextRequest, ctx: RouteContext<"/api/games/[gameId]/participants/[participantId]/claim">) => {
    const { gameId, participantId } = await ctx.params;
    await requireGameOwner(gameId);
    const { accept } = bodySchema.parse(await req.json());
    await resolveClaim(gameId, participantId, accept);
    return new Response(null, { status: 204 });
  },
);
