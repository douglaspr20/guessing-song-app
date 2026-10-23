import type { NextRequest } from "next/server";
import { deleteMemberGames } from "@/lib/access/admin";
import { requireHost } from "@/lib/access/session";
import { handle } from "@/lib/errors";

/** Borra todo el historial de un miembro sin tocar su cuenta. */
export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/host/members/[memberId]/games">) => {
  await requireHost();
  const { memberId } = await ctx.params;
  return Response.json({ deleted: await deleteMemberGames(memberId) });
});
