import { AppError } from "@/lib/errors";
import type { GameFilters } from "./filters";

/** Lo que se afloja, en este orden, cuando con los filtros no sale ninguna canción. */
export const RELAX_ORDER = ["popularity", "years", "keywords", "artists", "genres", "language"] as const;
export type Relaxed = (typeof RELAX_ORDER)[number];

/** Cada paso: si aplica a estos filtros y cómo quedan sin eso. */
const STEPS: Record<Relaxed, { applies: (f: GameFilters) => boolean; relax: (f: GameFilters) => GameFilters }> = {
  popularity: { applies: (f) => (f.popularity ?? "mix") !== "mix", relax: (f) => ({ ...f, popularity: "mix" }) },
  years: { applies: (f) => !!(f.yearFrom || f.yearTo), relax: (f) => ({ ...f, yearFrom: undefined, yearTo: undefined }) },
  keywords: { applies: (f) => !!f.keywords?.trim(), relax: (f) => ({ ...f, keywords: undefined }) },
  // Sin artistas las pistas vuelven a salir de los géneros (si se eligieron).
  artists: { applies: (f) => (f.artists?.length ?? 0) > 0, relax: (f) => ({ ...f, artists: [] }) },
  genres: { applies: (f) => f.genres.length > 0, relax: (f) => ({ ...f, genres: [] }) },
  language: { applies: (f) => !!(f.language || f.market), relax: (f) => ({ ...f, language: undefined, market: undefined }) },
};

const nothingFound = (err: unknown) => err instanceof AppError && err.code === "NO_TRACKS_FOUND";

/**
 * Elige con los filtros tal cual y, si no sale ninguna canción, los va aflojando en `RELAX_ORDER` hasta que salga:
 * mejor una canción de otros años que una ronda sin canción. Dice qué se aflojó para avisar en la tele. Cualquier otro
 * error (iTunes limitando, playlists bloqueadas, Spotify sin conectar) se propaga sin aflojar nada. Las playlists no
 * se aflojan: las eligió la persona.
 */
export async function pickWithFallback<T>(
  filters: GameFilters,
  pick: (filters: GameFilters) => Promise<T>,
): Promise<{ picked: T; relaxed: Relaxed[] }> {
  let current = filters;
  const relaxed: Relaxed[] = [];
  try {
    return { picked: await pick(current), relaxed };
  } catch (err) {
    if (!nothingFound(err) || current.source === "playlists") throw err;
    let last = err;
    for (const step of RELAX_ORDER) {
      if (!STEPS[step].applies(current)) continue;
      current = STEPS[step].relax(current);
      relaxed.push(step);
      try {
        return { picked: await pick(current), relaxed };
      } catch (next) {
        if (!nothingFound(next)) throw next;
        last = next;
      }
    }
    throw last;
  }
}
