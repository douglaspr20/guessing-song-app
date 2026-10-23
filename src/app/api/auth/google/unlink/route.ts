import { unlinkGoogle } from "@/lib/access/google";
import { requireUser } from "@/lib/access/session";
import { handle } from "@/lib/errors";

/** Quita el Google de la cuenta (solo si tiene contraseña para seguir entrando). */
export const POST = handle(async () => {
  const user = await requireUser();
  await unlinkGoogle(user.id);
  return Response.json({ linked: false });
});
