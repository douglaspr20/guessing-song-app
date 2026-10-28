import "server-only";
import { db } from "@/lib/db";
import type { Owner } from "@/lib/access/owner";

/**
 * Analítica propia y mínima: qué pasos da la gente (invitado nuevo, partida creada, empezada, terminada, móviles).
 * No se guarda nada que identifique a alguien: ni nombres, ni IP, ni ids de cuenta. Los eventos personalizados
 * de Vercel Analytics no están en el plan gratis, y así los datos quedan en nuestra base y se leen en el panel.
 */
export type EventType =
  | "guest_started"
  | "game_created"
  | "game_started"
  | "game_finished"
  | "phone_joined"
  | "phone_followed"
  | "result_shared";

/** Quién grabó la partida: el tipo de dueño, nunca su id. */
export type OwnerKind = "guest" | "free" | "member" | "host";

export function ownerKindOf(owner: Owner): OwnerKind {
  if (owner.kind === "guest") return "guest";
  if (owner.role === "host") return "host";
  return owner.spotifyAllowed ? "member" : "free";
}

export interface EventData {
  type: EventType;
  gameId?: string;
  mode?: string;
  format?: string;
  ownerKind?: OwnerKind;
  /** Partida creada con «Otra igual». */
  replay?: boolean;
}

/** Anota un evento. Medir nunca debe romper el juego: si falla, solo avisa en el log. */
export async function recordEvent(e: EventData) {
  try {
    await db.gameEvent.create({
      data: {
        type: e.type,
        gameId: e.gameId ?? null,
        mode: e.mode ?? null,
        format: e.format ?? null,
        ownerKind: e.ownerKind ?? null,
        replay: e.replay ?? false,
      },
    });
  } catch (err) {
    console.warn(`No se pudo anotar el evento ${e.type}`, err);
  }
}

/** Anota un evento de una partida que ya existe: modo, formato y tipo de dueño salen de ella. */
export async function recordGameEvent(type: EventType, gameId: string, extra: Pick<EventData, "replay"> = {}) {
  try {
    const game = await db.game.findUnique({
      where: { id: gameId },
      select: { mode: true, format: true, guestId: true, user: { select: { role: true, spotifyAllowed: true } } },
    });
    if (!game) return;
    const ownerKind: OwnerKind = !game.user
      ? "guest"
      : game.user.role === "host"
        ? "host"
        : game.user.spotifyAllowed
          ? "member"
          : "free";
    await recordEvent({ type, gameId, mode: game.mode, format: game.format, ownerKind, ...extra });
  } catch (err) {
    console.warn(`No se pudo anotar el evento ${type}`, err);
  }
}

/** La limpieza diaria borra los eventos de más de esto: sobra para ver la evolución de un año. */
export const EVENT_KEEP_DAYS = 400;

export function deleteStaleEvents(now = new Date()) {
  return db.gameEvent.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - EVENT_KEEP_DAYS * 24 * 60 * 60_000) } },
  });
}
