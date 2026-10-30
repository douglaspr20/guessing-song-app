import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientInfo } from "@/lib/access/request";
import { currentUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";
import { claimStatus, requestSeat, withdrawClaim } from "@/lib/game/join";

const bodySchema = z.object({ code: z.string().max(20), name: z.string().max(60) });

/** Alguien que perdió su sesión pide quedarse con su sitio (su nombre sigue ocupado): el anfitrión decide. */
export const POST = handle(async (req: NextRequest) => {
  const body = bodySchema.parse(await req.json());
  const [{ ipHash }, user] = await Promise.all([clientInfo(), currentUser()]);
  const seat = await requestSeat(body, { ipHash, user: user ? { id: user.id, displayName: user.displayName } : null });
  return Response.json(seat, { status: 201 });
});

/** ¿Ya me han dejado entrar? `pending`, `accepted` (la cookie ya es la del sitio) o `gone` (rechazado o caducado). */
export const GET = handle(async (req: NextRequest) => {
  const game = req.nextUrl.searchParams.get("game") ?? "";
  return Response.json({ status: await claimStatus(game) });
});

/** Quien esperaba se arrepiente: se retira su petición. */
export const DELETE = handle(async (req: NextRequest) => {
  await withdrawClaim(req.nextUrl.searchParams.get("game") ?? "");
  return new Response(null, { status: 204 });
});
