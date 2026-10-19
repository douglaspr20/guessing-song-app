import { z } from "zod";
import { authenticateMember } from "@/lib/access/accounts";
import { clientInfo } from "@/lib/access/request";
import { startSession } from "@/lib/access/session";
import { handle } from "@/lib/errors";

const bodySchema = z.object({ username: z.string().max(60), password: z.string().max(200) });

/** Login de un miembro. Body: { username, password } */
export const POST = handle(async (req: Request) => {
  const { username, password } = bodySchema.parse(await req.json());
  const { ipHash, userAgent } = await clientInfo();
  const user = await authenticateMember(username, password, ipHash);
  await startSession(user.id, userAgent);
  return Response.json({ username: user.username, displayName: user.displayName });
});
