import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getAppState } from "./state";

/** Topes del modo invitado: contienen abusos y protegen la cuota de iTunes y el espacio de la base de datos. */
export const GUEST_LIMITS = {
  /** Alto a propósito: una oficina, una universidad o una casa con mucha gente salen por la misma IP. */
  guestsPerIpPerDay: 30,
  gamesPerDay: 20,
  gamesStored: 50,
  /** Total de partidas de invitados (0,5 GB del plan gratis de Neon). */
  globalGuestGames: 3000,
  roundsPerHour: 60,
  /** «Probar filtros» en el modo abierto: cada prueba puede llamar a iTunes. */
  filterTestsPerHour: 20,
  /** La limpieza borra a los invitados sin actividad en este tiempo. */
  inactiveDays: 60,
};

const DAY_MS = 24 * 60 * 60_000;

export async function assertOpenModeAvailable() {
  const state = await getAppState();
  if (state.openModePaused) {
    throw new AppError("OPEN_MODE_PAUSED", 503);
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
    throw new AppError("GUEST_GAME_LIMIT", 429);
  }
  if (stored >= GUEST_LIMITS.gamesStored) {
    throw new AppError("GUEST_SHELF_FULL", 429);
  }
  if (global >= GUEST_LIMITS.globalGuestGames) {
    throw new AppError("GUEST_CAPACITY", 503);
  }
}

/**
 * Las cuentas gratis (con Google, sin invitación) son abiertas a cualquiera: llevan los mismos topes
 * por cuenta que un invitado. No cuentan para el tope global ni las frena la pausa del modo sin cuenta.
 */
export async function assertFreeUserCanCreateGame(userId: string, now = new Date()) {
  const [today, stored] = await Promise.all([
    db.game.count({ where: { userId, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } }),
    db.game.count({ where: { userId } }),
  ]);
  if (today >= GUEST_LIMITS.gamesPerDay) {
    throw new AppError("GUEST_GAME_LIMIT", 429);
  }
  if (stored >= GUEST_LIMITS.gamesStored) {
    throw new AppError("GUEST_SHELF_FULL", 429);
  }
}

/** Topes de quien no tiene invitación: invitados y cuentas gratis. Con invitación, sin topes. */
export async function assertOwnerCanCreateGame(owner: LimitedOwner) {
  if (owner.kind === "guest") return assertGuestCanCreateGame(owner.guestId);
  if (!owner.spotifyAllowed) return assertFreeUserCanCreateGame(owner.userId);
}

export async function assertOwnerCanStartRound(owner: LimitedOwner, now = new Date()) {
  if (owner.kind === "user" && owner.spotifyAllowed) return;
  const where = owner.kind === "guest" ? { guestId: owner.guestId } : { userId: owner.userId };
  const lastHour = await db.round.count({
    where: { game: where, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
  });
  if (lastHour >= GUEST_LIMITS.roundsPerHour) {
    throw new AppError("GUEST_ROUND_LIMIT", 429);
  }
}

/**
 * «Probar filtros» en el modo abierto: tope por hora para quien no tiene invitación (cada prueba puede
 * llamar a iTunes, y su límite es de todos). Si puede, deja la prueba anotada.
 */
export async function recordOwnerFilterTest(owner: LimitedOwner, now = new Date()) {
  if (owner.kind === "user" && owner.spotifyAllowed) return;
  const ownerKey = owner.kind === "guest" ? `guest:${owner.guestId}` : `user:${owner.userId}`;
  const lastHour = await db.filterTest.count({
    where: { ownerKey, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
  });
  if (lastHour >= GUEST_LIMITS.filterTestsPerHour) {
    throw new AppError("FILTER_TEST_LIMIT", 429);
  }
  await db.filterTest.create({ data: { ownerKey, createdAt: now } });
}

type LimitedOwner ={ kind: "user"; userId: string; spotifyAllowed: boolean } | { kind: "guest"; guestId: string };

export async function assertGuestCanStartRound(guestId: string, now = new Date()) {
  const lastHour = await db.round.count({
    where: { game: { guestId }, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
  });
  if (lastHour >= GUEST_LIMITS.roundsPerHour) {
    throw new AppError("GUEST_ROUND_LIMIT", 429);
  }
}
