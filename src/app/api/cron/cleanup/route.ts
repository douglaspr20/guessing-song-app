import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { runCleanup } from "@/lib/access/admin";
import { notFound } from "@/lib/access/session";
import { handle } from "@/lib/errors";

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Limpieza diaria (la llama Vercel Cron con `Authorization: Bearer $CRON_SECRET`): invitados inactivos
 * con sus partidas, intentos de login viejos y sesiones e invitaciones caducadas.
 */
export const GET = handle(async (req: Request) => {
  await connection();
  if (!authorized(req.headers.get("authorization"))) throw notFound();
  return Response.json(await runCleanup());
});
