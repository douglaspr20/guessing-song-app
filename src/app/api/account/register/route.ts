import { ZodError } from "zod";
import { registerMember } from "@/lib/access/accounts";
import { clientInfo } from "@/lib/access/request";
import { startSession } from "@/lib/access/session";
import { assertLoginAllowed, recordLoginAttempt } from "@/lib/access/throttle";
import { AppError, handle } from "@/lib/errors";

/** Alta con invitación. Body: { invite, username, password, displayName? }. Deja la sesión iniciada. */
export const POST = handle(async (req: Request) => {
  const { ipHash, userAgent } = await clientInfo();
  // Probar códigos de invitación al azar cuenta como intentos fallidos de login.
  await assertLoginAllowed(ipHash);
  try {
    const user = await registerMember(await req.json());
    await startSession(user.id, userAgent);
    return Response.json({ username: user.username, displayName: user.displayName }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError && err.code === "INVALID_INVITE") await recordLoginAttempt(ipHash, false);
    // Los mensajes del esquema (usuario, contraseña) ya están pensados para mostrarse tal cual.
    if (err instanceof ZodError) throw new AppError(err.issues[0]?.message ?? "Datos inválidos", 422, "VALIDATION_ERROR");
    throw err;
  }
});
