import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientInfo } from "@/lib/access/request";
import { handle } from "@/lib/errors";
import { lookupGame } from "@/lib/game/join";

const bodySchema = z.object({ code: z.string().max(20) });

/** Comprueba un código de partida y dice cómo se entra (equipos con hueco, nombres ya apuntados). */
export const POST = handle(async (req: NextRequest) => {
  const { code } = bodySchema.parse(await req.json());
  const { ipHash } = await clientInfo();
  return Response.json(await lookupGame(code, ipHash));
});
