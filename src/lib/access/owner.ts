import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { currentGuest } from "./guest";
import { assertOpenModeAvailable } from "./limits";
import { currentUser, notFound, type Role } from "./session";

/** Dueño de partidas: un usuario con sesión o un invitado anónimo. */
export type Owner =
  | { kind: "user"; userId: string; role: Role; spotifyAllowed: boolean }
  | { kind: "guest"; guestId: string };

export function ownerWhere(owner: Owner) {
  return owner.kind === "user" ? { userId: owner.userId } : { guestId: owner.guestId };
}

export function ownerData(owner: Owner) {
  return owner.kind === "user" ? { userId: owner.userId, guestId: null } : { userId: null, guestId: owner.guestId };
}

/** La sesión manda sobre la cookie de invitado. */
export async function currentOwner(): Promise<Owner | null> {
  const user = await currentUser();
  if (user) return { kind: "user", userId: user.id, role: user.role, spotifyAllowed: user.spotifyAllowed };
  const guest = await currentGuest();
  return guest ? { kind: "guest", guestId: guest.id } : null;
}

export async function requireOwner(): Promise<Owner> {
  const owner = await currentOwner();
  if (!owner) throw notFound();
  return owner;
}

/** Comprueba que la partida es de este dueño. Si no, 404 (como si no existiera). */
export async function assertOwnsGame(owner: Owner, gameId: string) {
  const game = await db.game.findUnique({ where: { id: gameId }, select: { userId: true, guestId: true } });
  const mine = owner.kind === "user" ? game?.userId === owner.userId : game?.guestId === owner.guestId;
  if (!game || !mine) throw new AppError("GAME_NOT_FOUND", 404);
  if (owner.kind === "guest") await assertOpenModeAvailable();
}

/** Atajo para las rutas de una partida: el dueño actual y la comprobación de que es suya. */
export async function requireGameOwner(gameId: string): Promise<Owner> {
  const owner = await requireOwner();
  await assertOwnsGame(owner, gameId);
  return owner;
}
