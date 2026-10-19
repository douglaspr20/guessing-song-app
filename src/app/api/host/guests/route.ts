import { connection } from "next/server";
import { z } from "zod";
import { blockIp, deleteAllGuests, deleteInactiveGuests, guestOverview, unblockIp } from "@/lib/access/admin";
import { requireHost } from "@/lib/access/session";
import { setAppFlags } from "@/lib/access/state";
import { handle } from "@/lib/errors";

/** Resumen del modo invitado para el panel del anfitrión. */
export const GET = handle(async () => {
  await connection();
  await requireHost();
  return Response.json(await guestOverview());
});

const flagsSchema = z.object({ openModePaused: z.boolean().optional(), guestSignupsPaused: z.boolean().optional() });

/** Interruptores: pausar el modo abierto o la creación de invitados. */
export const PATCH = handle(async (req: Request) => {
  await requireHost();
  await setAppFlags(flagsSchema.parse(await req.json()));
  return Response.json(await guestOverview());
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete-inactive") }),
  z.object({ action: z.literal("delete-all"), confirm: z.literal("BORRAR") }),
  z.object({ action: z.literal("block-ip"), ipHash: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ action: z.literal("unblock-ip"), ipHash: z.string().regex(/^[a-f0-9]{64}$/) }),
]);

/** Acciones de respaldo ante abusos. Body: { action, ... } */
export const POST = handle(async (req: Request) => {
  await requireHost();
  const body = actionSchema.parse(await req.json());
  let affected = 0;
  if (body.action === "delete-inactive") affected = await deleteInactiveGuests();
  if (body.action === "delete-all") affected = await deleteAllGuests();
  if (body.action === "block-ip") affected = await blockIp(body.ipHash);
  if (body.action === "unblock-ip") await unblockIp(body.ipHash);
  return Response.json({ affected, overview: await guestOverview() });
});
