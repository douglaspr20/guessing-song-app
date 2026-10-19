import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getAppState } from "./state";

/** Topes del modo invitado: contienen abusos y protegen la cuota de iTunes y el espacio de la base de datos. */
export const GUEST_LIMITS = {
  guestsPerIpPerDay: 10,
  gamesPerDay: 20,
  gamesStored: 50,
  /** Total de partidas de invitados (0,5 GB del plan gratis de Neon). */
  globalGuestGames: 3000,
  roundsPerHour: 60,
  /** La limpieza borra a los invitados sin actividad en este tiempo. */
  inactiveDays: 60,
};

const DAY_MS = 24 * 60 * 60_000;

export async function assertOpenModeAvailable() {
  const state = await getAppState();
  if (state.openModePaused) {
    throw new AppError(
      "El modo sin cuenta está en mantenimiento. Vuelve a probar en un rato.",
      503,
      "OPEN_MODE_PAUSED",
    );
  }
}

export async function assertGuestCanCreateGame(guestId: string, now = new Date()) {
  await assertOpenModeAvailable();
  const [today, stored, global] = await Promise.all([
    db.game.count({ where: { guestId, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } }),
    db.game.count({ where: { guestId } }),
    db.game.count({ where: { guestId: { not: null } } }),
  ]);
  if (today >= GUEST_LIMITS.gamesPerDay) {
    throw new AppError("Has grabado muchas partidas hoy. Vuelve mañana.", 429, "GUEST_GAME_LIMIT");
  }
  if (stored >= GUEST_LIMITS.gamesStored) {
    throw new AppError("Tu estantería está llena: borra alguna partida para grabar otra.", 429, "GUEST_SHELF_FULL");
  }
  if (global >= GUEST_LIMITS.globalGuestGames) {
    throw new AppError("El modo sin cuenta está lleno ahora mismo. Prueba más tarde.", 503, "GUEST_CAPACITY");
  }
}

export async function assertGuestCanStartRound(guestId: string, now = new Date()) {
  const lastHour = await db.round.count({
    where: { game: { guestId }, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
  });
  if (lastHour >= GUEST_LIMITS.roundsPerHour) {
    throw new AppError("Demasiadas rondas seguidas. Descansa unos minutos.", 429, "GUEST_ROUND_LIMIT");
  }
}
