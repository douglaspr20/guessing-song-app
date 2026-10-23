import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { GUEST_LIMITS } from "./limits";
import { revokeSessions } from "./session";
import { getAppState } from "./state";

const DAY_MS = 24 * 60 * 60_000;

// ---------- Miembros ----------

export async function listMembers() {
  const users = await db.user.findMany({
    where: { role: "member" },
    orderBy: { createdAt: "asc" },
    include: {
      spotify: { select: { displayName: true } },
      google: { select: { email: true } },
      sessions: { select: { lastSeenAt: true }, orderBy: { lastSeenAt: "desc" }, take: 1 },
      _count: { select: { games: true, sessions: true } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    createdAt: u.createdAt,
    disabled: !!u.disabledAt,
    spotifyAllowed: u.spotifyAllowed,
    google: u.google?.email ?? null,
    hasPassword: !!u.passwordHash,
    spotify: u.spotify?.displayName ?? (u.spotify ? "" : null),
    games: u._count.games,
    sessions: u._count.sessions,
    lastSeenAt: u.sessions[0]?.lastSeenAt ?? null,
  }));
}

async function loadMember(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user || user.role !== "member") throw new AppError("Miembro no encontrado", 404, "MEMBER_NOT_FOUND");
  return user;
}

/** Desactivar también cierra sus sesiones. */
export async function setMemberDisabled(id: string, disabled: boolean) {
  await loadMember(id);
  await db.user.update({ where: { id }, data: { disabledAt: disabled ? new Date() : null } });
  if (disabled) await revokeSessions(id);
}

/** Da o quita el modo Spotify. Quitarlo también desvincula su cuenta de Spotify. */
export async function setMemberSpotify(id: string, allowed: boolean) {
  await loadMember(id);
  await db.user.update({ where: { id }, data: { spotifyAllowed: allowed } });
  if (!allowed) await db.spotifyAccount.deleteMany({ where: { userId: id } });
}

/** Borra todas las partidas del miembro; su cuenta y su Spotify se mantienen. */
export async function deleteMemberGames(id: string) {
  await loadMember(id);
  const { count } = await db.game.deleteMany({ where: { userId: id } });
  return count;
}

/** Borra al miembro con sus partidas, sesiones y Spotify vinculado. */
export async function deleteMember(id: string) {
  await loadMember(id);
  await db.user.delete({ where: { id } });
}

// ---------- Invitados ----------

export async function guestOverview(now = new Date()) {
  const since = new Date(now.getTime() - DAY_MS);
  const [state, guests, newGuests, blocked, games, topIps, blockedIps] = await Promise.all([
    getAppState(),
    db.guest.count(),
    db.guest.count({ where: { createdAt: { gt: since } } }),
    db.guest.count({ where: { blockedAt: { not: null } } }),
    db.game.count({ where: { guestId: { not: null } } }),
    db.guest.groupBy({
      by: ["ipHash"],
      where: { createdAt: { gt: since } },
      _count: { _all: true },
      orderBy: { _count: { ipHash: "desc" } },
      take: 5,
    }),
    db.blockedIp.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return {
    openModePaused: state.openModePaused,
    guestSignupsPaused: state.guestSignupsPaused,
    guests,
    newGuests,
    blocked,
    games,
    gameCapacity: GUEST_LIMITS.globalGuestGames,
    inactiveDays: GUEST_LIMITS.inactiveDays,
    // Solo un trozo del hash: basta para distinguirlas sin exponer nada útil.
    topIps: topIps.map((t) => ({ ipHash: t.ipHash, label: t.ipHash.slice(0, 10), guests: t._count._all })),
    blockedIps: blockedIps.map((b) => ({ ipHash: b.ipHash, label: b.ipHash.slice(0, 10), createdAt: b.createdAt })),
  };
}

/** Borra los invitados sin actividad en `days` días (y sus partidas, en cascada). */
export async function deleteInactiveGuests(days = GUEST_LIMITS.inactiveDays, now = new Date()) {
  const { count } = await db.guest.deleteMany({ where: { lastSeenAt: { lt: new Date(now.getTime() - days * DAY_MS) } } });
  return count;
}

/** Botón del pánico: borra a todos los invitados y sus partidas. */
export async function deleteAllGuests() {
  const { count } = await db.guest.deleteMany({});
  return count;
}

/** Cierra el modo invitado a una IP: sus invitados actuales quedan bloqueados y no puede crear otros. */
export async function blockIp(ipHash: string) {
  await db.blockedIp.upsert({ where: { ipHash }, create: { ipHash }, update: {} });
  const { count } = await db.guest.updateMany({ where: { ipHash, blockedAt: null }, data: { blockedAt: new Date() } });
  return count;
}

export async function unblockIp(ipHash: string) {
  await db.blockedIp.deleteMany({ where: { ipHash } });
  await db.guest.updateMany({ where: { ipHash }, data: { blockedAt: null } });
}

// ---------- Limpieza diaria ----------

export async function runCleanup(now = new Date()) {
  const [guests, attempts, sessions, invites] = await Promise.all([
    deleteInactiveGuests(GUEST_LIMITS.inactiveDays, now),
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY_MS) } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.invite.deleteMany({ where: { usedAt: null, expiresAt: { lt: now } } }),
  ]);
  return { guests, loginAttempts: attempts.count, sessions: sessions.count, invites: invites.count };
}
