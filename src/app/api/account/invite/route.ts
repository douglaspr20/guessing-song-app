import { z } from "zod";
import { redeemInvite } from "@/lib/access/accounts";
import { clientInfo } from "@/lib/access/request";
import { requireUser } from "@/lib/access/session";
import { assertLoginAllowed, recordLoginAttempt } from "@/lib/access/throttle";
import { AppError, handle } from "@/lib/errors";

const bodySchema = z.object({ invite: z.string().trim().min(1).max(40) });

/** Una cuenta que ya existe canjea una invitación y gana el modo Spotify. Body: { invite } */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { invite } = bodySchema.parse(await req.json());
  const { ipHash } = await clientInfo();
  // Probar códigos al azar cuenta como intentos fallidos, igual que en el registro.
  await assertLoginAllowed(ipHash);
  try {
    await redeemInvite(user.id, invite);
    return Response.json({ spotifyAllowed: true });
  } catch (err) {
    if (err instanceof AppError && err.code === "INVALID_INVITE") await recordLoginAttempt(ipHash, false);
    throw err;
  }
});
