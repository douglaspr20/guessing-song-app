import { connection } from "next/server";
import { z } from "zod";
import { createInvite, listInvites } from "@/lib/access/invites";
import { requireHost } from "@/lib/access/session";
import { handle } from "@/lib/errors";

export const GET = handle(async () => {
  await connection();
  await requireHost();
  return Response.json({ invites: await listInvites() });
});

const bodySchema = z.object({ note: z.string().trim().max(60).optional() });

/** Crea una invitación. El código solo aparece en esta respuesta. Body: { note? } */
export const POST = handle(async (req: Request) => {
  await requireHost();
  const { note } = bodySchema.parse(await req.json());
  return Response.json(await createInvite(note || null), { status: 201 });
});
