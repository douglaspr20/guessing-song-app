import type { NextRequest } from "next/server";
import { revokeInvite } from "@/lib/access/invites";
import { requireHost } from "@/lib/access/session";
import { handle } from "@/lib/errors";

/** Anula una invitación sin usar. */
export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/host/invites/[inviteId]">) => {
  await requireHost();
  const { inviteId } = await ctx.params;
  await revokeInvite(inviteId);
  return new Response(null, { status: 204 });
});
