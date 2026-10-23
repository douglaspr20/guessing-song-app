import { z, ZodError } from "zod";
import { changePassword } from "@/lib/access/passwords";
import { clientInfo } from "@/lib/access/request";
import { currentSessionId, requireUser } from "@/lib/access/session";
import { AppError, handle } from "@/lib/errors";

const bodySchema = z.object({ current: z.string().max(200).optional(), next: z.string().max(200) });

/** Cambia (o pone) la contraseña del usuario. Body: { current?, next }. Cierra sus otras sesiones. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = bodySchema.parse(await req.json());
  const { ipHash } = await clientInfo();
  try {
    const result = await changePassword(user.id, body, { ipHash, keepSessionId: await currentSessionId() });
    return Response.json(result);
  } catch (err) {
    // El mensaje del esquema («al menos 8 caracteres») ya está pensado para mostrarse tal cual.
    if (err instanceof ZodError) throw new AppError(err.issues[0]?.message ?? "Datos inválidos", 422, "VALIDATION_ERROR");
    throw err;
  }
});
