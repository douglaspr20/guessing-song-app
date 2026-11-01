import "server-only";
import { db } from "@/lib/db";
import type { Track } from "@/lib/spotify/types";
import { searchSongs } from "./search";

export const ITUNES_CACHE = {
  /** Mientras una búsqueda sea más nueva que esto, no se vuelve a preguntar a iTunes. */
  freshMs: 6 * 60 * 60_000,
  /** Una búsqueda sin resultados se recuerda menos: puede que solo fuera un mal momento de iTunes. */
  emptyFreshMs: 60 * 60_000,
  /** La limpieza diaria borra lo que lleva más de esto sin renovarse (las palabras clave son texto libre). */
  keepDays: 30,
};

type Search = { term: string; country: string; attribute?: "artistTerm" };

/** La clave de la caché: el mismo término escrito con otras mayúsculas o espacios es la misma búsqueda. */
export const normalizeTerm = (term: string) => term.trim().replace(/\s+/g, " ").toLowerCase();

/** Buscar solo por artista es otra búsqueda: se guarda como `artist:<término>` (sin tocar la tabla). */
const cacheTerm = ({ term, attribute }: Search) => (attribute ? `artist:${normalizeTerm(term)}` : normalizeTerm(term));

/**
 * Busca en iTunes pasando por la caché de Postgres: todas las visitas salen por las IP de Vercel y iTunes
 * limita por IP, así que las búsquedas repetidas (géneros, palabras comunes) se sirven de la tabla.
 * Si iTunes falla y hay una búsqueda guardada, aunque sea vieja, se juega con ella.
 */
export async function cachedSearch(
  search: Search,
  fetchSongs: (p: Search) => Promise<Track[]> = searchSongs,
  now = new Date(),
): Promise<Track[]> {
  const { country, attribute } = search;
  const key = { term: cacheTerm(search), country };
  const saved = await db.itunesSearch.findUnique({ where: { term_country: key } });
  if (saved) {
    const tracks = saved.tracks as unknown as Track[];
    const freshFor = tracks.length ? ITUNES_CACHE.freshMs : ITUNES_CACHE.emptyFreshMs;
    if (now.getTime() - saved.fetchedAt.getTime() < freshFor) return tracks;
  }

  let tracks: Track[];
  try {
    tracks = await fetchSongs({ term: normalizeTerm(search.term), country, attribute });
  } catch (err) {
    if (!saved) throw err;
    console.warn(`iTunes falló para «${key.term}» (${country}); se usa la búsqueda guardada`, err);
    return saved.tracks as unknown as Track[];
  }

  const data = { tracks: tracks as unknown as object, fetchedAt: now };
  await db.itunesSearch.upsert({ where: { term_country: key }, create: { ...key, ...data }, update: data });
  return tracks;
}

/** Para la limpieza diaria: borra las búsquedas que llevan `keepDays` sin renovarse. */
export function deleteStaleItunesSearches(now = new Date()) {
  return db.itunesSearch.deleteMany({
    where: { fetchedAt: { lt: new Date(now.getTime() - ITUNES_CACHE.keepDays * 24 * 60 * 60_000) } },
  });
}
