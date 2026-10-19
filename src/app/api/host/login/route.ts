import { z } from "zod";
import { authenticateHost } from "@/lib/access/host";
import { clientInfo } from "@/lib/access/request";
import { startSession } from "@/lib/access/session";
import { handle } from "@/lib/errors";

const bodySchema = z.object({ password: z.string().max(200), code: z.string().max(12) });

/** Entrada del anfitrión. Body: { password, code } (código de la app de autenticación). */
export const POST = handle(async (req: Request) => {
  const { password, code } = bodySchema.parse(await req.json());
  const { ipHash, userAgent } = await clientInfo();
  const user = await authenticateHost(password, code, ipHash);
  await startSession(user.id, userAgent);
  return Response.json({ host: true });
});
