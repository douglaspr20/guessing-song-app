import "server-only";
import { googleConfig } from "@/lib/access/google";
import { currentGuest } from "@/lib/access/guest";
import { currentUser } from "@/lib/access/session";
import { getAppState } from "@/lib/access/state";
import type { AccessStatus } from "@/lib/client/api";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getSpotifyAccount } from "@/lib/spotify/auth";
import { getMe } from "@/lib/spotify/sources";

/**
 * Quién está usando la app: usuario con sesión, invitado o nadie, y si tiene Spotify vinculado. Lo leen
 * `GET /api/access/status` y la portada al pintarse en el servidor.
 */
export async function getAccessStatus(): Promise<AccessStatus> {
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

  let spotify: AccessStatus["spotify"] = null;
  let login: { hasPassword: boolean; mustChangePassword: boolean; google: { email: string } | null } | null = null;
  if (user) {
    const row = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, mustChangePassword: true, google: { select: { email: true } } },
    });
    login = {
      hasPassword: !!row?.passwordHash,
      mustChangePassword: !!row?.mustChangePassword,
      google: row?.google ?? null,
    };
    const account = await getSpotifyAccount(user.id);
    if (account) {
      // El perfil dice si es Premium; si Spotify falla, al menos sabemos que está vinculado.
      const profile = await getMe(user.id).catch(() => null);
      spotify = { linked: true, displayName: profile?.displayName ?? account.displayName, premium: profile?.premium ?? null };
    }
  }

  return {
    user: user && {
      username: user.username,
      displayName: user.displayName,
      role: user.role as "host" | "member",
      spotifyAllowed: user.spotifyAllowed,
      hasPassword: login?.hasPassword ?? false,
      mustChangePassword: login?.mustChangePassword ?? false,
      google: login?.google ?? null,
    },
    guest,
    spotify,
    openModePaused,
    googleEnabled: !!googleConfig(),
  };
}
