import type { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/access/session";
import { clientInfo } from "@/lib/access/request";
import { handle } from "@/lib/errors";
import { joinGame } from "@/lib/game/join";

const bodySchema = z.object({
  code: z.string().max(20),
  name: z.string().max(60).optional(),
  teamId: z.string().max(60).optional(),
});

/** Entra en una partida con su código. Con sesión iniciada usa el nombre de la cuenta. */
export const POST = handle(async (req: NextRequest) => {
  const body = bodySchema.parse(await req.json());
  const [{ ipHash }, user] = await Promise.all([clientInfo(), currentUser()]);
  const joined = await joinGame(body, { ipHash, user: user ? { id: user.id, displayName: user.displayName } : null });
  return Response.json(joined, { status: 201 });
});
