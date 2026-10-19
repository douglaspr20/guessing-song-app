import { connection } from "next/server";
import { currentGuest } from "@/lib/access/guest";
import { currentUser } from "@/lib/access/session";
import { getAppState } from "@/lib/access/state";
import { AppError, handle } from "@/lib/errors";
import { getSpotifyAccount } from "@/lib/spotify/auth";
import { getMe } from "@/lib/spotify/sources";

/** Quién está usando la app: usuario con sesión, invitado o nadie, y si tiene Spotify vinculado. */
export const GET = handle(async () => {
  await connection(); // siempre en tiempo de petición (lee cookies y BD)
  const user = await currentUser();
  let guest = false;
  if (!user) {
    try {
      guest = !!(await currentGuest());
    } catch (err) {
      // Invitado bloqueado: para la portada es como no tener invitado (al intentar jugar verá el aviso).
      if (!(err instanceof AppError)) throw err;
    }
  }
  const { openModePaused } = await getAppState();

  let spotify = null;
  if (user) {
    const account = await getSpotifyAccount(user.id);
    if (account) {
      // El perfil dice si es Premium; si Spotify falla, al menos sabemos que está vinculado.
      const profile = await getMe(user.id).catch(() => null);
      spotify = { linked: true, displayName: profile?.displayName ?? account.displayName, premium: profile?.premium ?? null };
    }
  }

  return Response.json({
    user: user && { username: user.username, displayName: user.displayName, role: user.role },
    guest,
    spotify,
    openModePaused,
  });
});
