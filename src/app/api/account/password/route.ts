import { z } from "zod";
import { changePassword } from "@/lib/access/passwords";
import { clientInfo } from "@/lib/access/request";
import { currentSessionId, requireUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";

const bodySchema = z.object({ current: z.string().max(200).optional(), next: z.string().max(200) });

/** Cambia (o pone) la contraseña del usuario. Body: { current?, next }. Cierra sus otras sesiones. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = bodySchema.parse(await req.json());
  const { ipHash } = await clientInfo();
  // Los mensajes del esquema («al menos 8 caracteres») salen traducidos de `toErrorResponse`.
  const result = await changePassword(user.id, body, { ipHash, keepSessionId: await currentSessionId() });
  return Response.json(result);
});
