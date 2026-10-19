import { connection } from "next/server";
import { listMembers } from "@/lib/access/admin";
import { requireHost } from "@/lib/access/session";
import { handle } from "@/lib/errors";

export const GET = handle(async () => {
  await connection();
  await requireHost();
  return Response.json({ members: await listMembers() });
});
