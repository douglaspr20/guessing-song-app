import type { ChosenArtist, GameFilters, Popularity } from "./filters";

/** De dónde sale una pista: un género o un artista elegido (con su id, para no confundirlo con otro del mismo nombre). */
export type Seed = { kind: "genre"; value: string } | { kind: "artist"; value: string; id: string };

/** Si hay artistas elegidos, las pistas salen solo de ellos; si no, de los géneros. */
export function seedsOf(filters: Pick<GameFilters, "artists" | "genres">): Seed[] {
  return filters.artists.length
    ? filters.artists.map((a) => ({ kind: "artist", value: a.name, id: a.id }))
    : filters.genres.map((value) => ({ kind: "genre", value }));
}

/** Texto para comparar nombres: sin tildes, mayúsculas ni espacios de más. */
export const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** `spotify:abc` → { source: "spotify", raw: "abc" }. */
export function parseArtistId(id: string): { source: string; raw: string } {
  const at = id.indexOf(":");
  return at < 0 ? { source: "", raw: id } : { source: id.slice(0, at), raw: id.slice(at + 1) };
}

/**
 * ¿La canción es del artista elegido? Si su id es de la misma fuente que la canción, se compara el id (dos artistas
 * pueden llamarse igual); si no, el nombre exacto («Shakira» no vale para «Shakira Jasmine» ni para una colaboración).
 */
export function byArtist(track: { artists: readonly string[]; artistIds?: readonly string[] }, chosen: Pick<ChosenArtist, "name" | "id">, source: "spotify" | "itunes") {
  const { source: from, raw } = parseArtistId(chosen.id);
  if (from === source && raw && track.artistIds?.length) return track.artistIds.includes(raw);
  return track.artists.some((a) => plain(a) === plain(chosen.name));
}

/**
 * Popularidad por posición: tanto iTunes como Spotify ordenan sus resultados por relevancia, que en la práctica
 * pone los éxitos arriba (Spotify ya no da su cifra de popularidad).
 */
export const POPULARITY_WINDOW = {
  /** «Solo éxitos»: los primeros resultados. */
  hits: 40,
  /** «Joyas escondidas»: a partir de aquí (si hay pocos, la mitad de abajo). */
  gemsFrom: 60,
};

/** Las que entran en el nivel de popularidad, conservando el orden de la búsqueda. */
export function byPopularity<T>(ranked: T[], level: Popularity): T[] {
  if (level === "hits") return ranked.slice(0, POPULARITY_WINDOW.hits);
  if (level === "gems") {
    const from = ranked.length >= POPULARITY_WINDOW.gemsFrom + 20 ? POPULARITY_WINDOW.gemsFrom : Math.floor(ranked.length / 2);
    return ranked.slice(from);
  }
  return ranked;
}
