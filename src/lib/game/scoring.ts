import { stripTitleExtras } from "./matcher";

/** Cada cuánto baja el valor del título y se desbloquea una pista. */
export const HINT_INTERVAL_MS = 20_000;
/** Puntos por acertar el título en cada tramo de 20 s. */
export const TITLE_POINTS = [3, 2, 1] as const;
/** Punto extra por acertar el artista (antes de que salga como pista). */
export const ARTIST_POINTS = 1;

/** Orden de las pistas: una cada 20 s desde que empieza a sonar. */
export const HINT_ORDER = ["words", "artist", "letters"] as const;
export type HintType = (typeof HINT_ORDER)[number];

export interface Hint {
  type: HintType;
  /** `null` si no hay dato. */
  value: string | null;
}

/** Datos de la ronda que necesitan las reglas. */
export interface RoundClock {
  playStartedAt: Date | null;
  /** Si está en pausa, desde cuándo. */
  pausedAt?: Date | null;
  /** Tiempo total ya pasado en pausas anteriores. */
  pausedMs?: number;
  trackName: string;
  artists: string[];
  genre: string | null;
}

type ClockTimes = Pick<RoundClock, "playStartedAt" | "pausedAt" | "pausedMs">;

/** Tiempo de ronda transcurrido en `at`, descontando las pausas. 0 si aún no ha sonado. */
export function elapsedMs(round: ClockTimes, at: Date): number {
  if (!round.playStartedAt) return 0;
  const t = at.getTime();
  const paused =
    (round.pausedMs ?? 0) + (round.pausedAt && t > round.pausedAt.getTime() ? t - round.pausedAt.getTime() : 0);
  return Math.max(0, t - round.playStartedAt.getTime() - paused);
}

/** 3 puntos antes de 20 s, 2 antes de 40 s, 1 después. */
export function pointsForElapsed(ms: number): number {
  const tier = Math.floor(ms / HINT_INTERVAL_MS);
  return TITLE_POINTS[Math.min(tier, TITLE_POINTS.length - 1)];
}

/** Cuándo se desbloquea cada pista (ms desde que empezó a sonar). */
export function hintUnlockMs(type: HintType): number {
  return (HINT_ORDER.indexOf(type) + 1) * HINT_INTERVAL_MS;
}

/** "De Música Ligera" → "D_ M_____ L_____" (sobre el título sin "- Remastered", "(feat...)"). */
export function titleLetters(trackName: string): string {
  const title = stripTitleExtras(trackName) || trackName;
  return title
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const letters = [...w].filter((c) => /[\p{L}\p{N}]/u.test(c));
      if (!letters.length) return w;
      return letters[0].toUpperCase() + "_".repeat(letters.length - 1);
    })
    .join(" ");
}

/** "3 palabras" (sobre el título sin "- Remastered", "(feat...)"). */
export function titleWordCount(trackName: string): string {
  const title = stripTitleExtras(trackName) || trackName;
  const n = title.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return n === 1 ? "1 palabra" : `${n} palabras`;
}

function hintValue(type: HintType, round: RoundClock): string | null {
  switch (type) {
    case "words":
      return titleWordCount(round.trackName);
    case "artist":
      return round.artists.join(", ");
    case "letters":
      return titleLetters(round.trackName);
  }
}

/**
 * Pistas visibles en `now` y cuándo sale la siguiente.
 * Con `revealAll` (ronda cerrada) se muestran todas.
 */
export function unlockedHints(round: RoundClock, now: Date, revealAll = false) {
  const elapsed = elapsedMs(round, now);
  const hints: Hint[] = [];
  let nextHintAt: Date | null = null;
  for (const type of HINT_ORDER) {
    const unlock = hintUnlockMs(type);
    if (revealAll || (round.playStartedAt && elapsed >= unlock)) {
      hints.push({ type, value: hintValue(type, round) });
    } else if (!nextHintAt && round.playStartedAt && !round.pausedAt) {
      // En pausa no hay "siguiente pista" programada: el reloj está parado.
      nextHintAt = new Date(round.playStartedAt.getTime() + unlock + (round.pausedMs ?? 0));
    }
  }
  return { hints, nextHintAt };
}

/** El punto de artista solo vale antes de que el artista salga como pista. */
export function artistAvailable(round: ClockTimes, at: Date): boolean {
  return elapsedMs(round, at) < hintUnlockMs("artist");
}
