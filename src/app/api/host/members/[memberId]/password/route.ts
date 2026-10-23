import type { NextRequest } from "next/server";
import { resetMemberPassword } from "@/lib/access/passwords";
import { requireHost } from "@/lib/access/session";
import { handle } from "@/lib/errors";

/** Restablece la contraseña de un miembro. La temporal solo se devuelve en esta respuesta. */
export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/host/members/[memberId]/password">) => {
  await requireHost();
  const { memberId } = await ctx.params;
  return Response.json(await resetMemberPassword(memberId), { headers: { "Cache-Control": "no-store" } });
});
