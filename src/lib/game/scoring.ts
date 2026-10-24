import { stripTitleExtras } from "./matcher";

/** Puntos por acertar el título en cada tramo de tiempo. */
export const TITLE_POINTS = [3, 2, 1] as const;
/** Punto extra por acertar el artista (antes de que salga como pista). */
export const ARTIST_POINTS = 1;

/** Orden de las pistas desde que empieza a sonar. */
export const HINT_ORDER = ["words", "artist", "letters"] as const;
export type HintType = (typeof HINT_ORDER)[number];

/** Tiempos de una partida: cuándo baja el valor del título y cuándo sale cada pista. */
export interface RoundRules {
  /** Momentos (ms) en que el título pasa de 3 a 2 y de 2 a 1 punto. */
  tierMs: readonly number[];
  /** Cuándo se desbloquea cada pista (ms desde que empezó a sonar). */
  hintAtMs: Readonly<Record<HintType, number>>;
}

/** Fragmentos de 60 s o más: tramos y pistas cada 20 s. */
export const SPOTIFY_RULES: RoundRules = {
  tierMs: [20_000, 40_000],
  hintAtMs: { words: 20_000, artist: 40_000, letters: 60_000 },
};

/** Vistas previas de 30 s: todo escalado a 10 s, con las letras a los 25 s para que den tiempo. */
export const OPEN_RULES: RoundRules = {
  tierMs: [10_000, 20_000],
  hintAtMs: { words: 10_000, artist: 20_000, letters: 25_000 },
};

export function rulesFor(mode: string | null | undefined): RoundRules {
  return mode === "open" ? OPEN_RULES : SPOTIFY_RULES;
}

export interface Hint {
  type: HintType;
  /** `null` si no hay dato. */
  value: string | null;
}

/** Cuánto antes del final del fragmento se da por acabado (la tele congela el reloj al acabarse el audio). */
export const FRAGMENT_END_TOLERANCE_MS = 2_000;

/** El fragmento ya sonó entero: la tele frenó el reloj al acabarse el audio y no es una pausa del anfitrión. */
export const fragmentEnded = (round: { fragmentMs: number; elapsedMs: number }) =>
  round.elapsedMs >= round.fragmentMs - FRAGMENT_END_TOLERANCE_MS;

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

/** 3 puntos antes del primer tramo, 2 antes del segundo, 1 después (20/40 s en Spotify, 10/20 s en abierto). */
export function pointsForElapsed(ms: number, rules: RoundRules = SPOTIFY_RULES): number {
  const tier = rules.tierMs.filter((t) => ms >= t).length;
  return TITLE_POINTS[Math.min(tier, TITLE_POINTS.length - 1)];
}

/** Cuánto falta para que baje el valor del título; null si ya vale lo mínimo. */
export function nextTierInMs(ms: number, rules: RoundRules = SPOTIFY_RULES): number | null {
  const next = rules.tierMs.find((t) => t > ms);
  return next === undefined ? null : next - ms;
}

/** Cuándo se desbloquea cada pista (ms desde que empezó a sonar). */
export function hintUnlockMs(type: HintType, rules: RoundRules = SPOTIFY_RULES): number {
  return rules.hintAtMs[type];
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
export function unlockedHints(round: RoundClock, now: Date, revealAll = false, rules: RoundRules = SPOTIFY_RULES) {
  const elapsed = elapsedMs(round, now);
  const hints: Hint[] = [];
  let nextHintAt: Date | null = null;
  for (const type of HINT_ORDER) {
    const unlock = hintUnlockMs(type, rules);
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
export function artistAvailable(round: ClockTimes, at: Date, rules: RoundRules = SPOTIFY_RULES): boolean {
  return elapsedMs(round, at) < hintUnlockMs("artist", rules);
}
