import type { NextRequest } from "next/server";
import { z } from "zod";
import { deleteMember, setMemberDisabled } from "@/lib/access/admin";
import { requireHost, revokeSessions } from "@/lib/access/session";
import { handle } from "@/lib/errors";

type Ctx = RouteContext<"/api/host/members/[memberId]">;

const patchSchema = z.object({ disabled: z.boolean().optional(), revokeSessions: z.literal(true).optional() });

/** Desactiva/reactiva al miembro o le cierra las sesiones. Body: { disabled?, revokeSessions? } */
export const PATCH = handle(async (req: NextRequest, ctx: Ctx) => {
  await requireHost();
  const { memberId } = await ctx.params;
  const body = patchSchema.parse(await req.json());
  if (body.disabled !== undefined) await setMemberDisabled(memberId, body.disabled);
  if (body.revokeSessions) await revokeSessions(memberId);
  return new Response(null, { status: 204 });
});

/** Borra al miembro con todas sus partidas. */
export const DELETE = handle(async (_req: NextRequest, ctx: Ctx) => {
  await requireHost();
  const { memberId } = await ctx.params;
  await deleteMember(memberId);
  return new Response(null, { status: 204 });
});
