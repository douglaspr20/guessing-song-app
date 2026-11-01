import { matchesStoreGenre } from "@/lib/game/open-picker";
import { plain } from "@/lib/game/seeds";
import type { Track } from "@/lib/spotify/types";

/** Una tarjeta del directorio de artistas. */
export interface DirectoryArtist {
  /** `spotify:<id>` o `itunes:<id>`: dos artistas pueden llamarse igual (hay muchos «A» en Spotify). */
  id: string;
  name: string;
  /** Foto (Spotify) o portada de su canción más conocida (iTunes), a unos 300 px. */
  image: string | null;
}

/** Tarjetas por página. */
export const ARTISTS_PAGE_SIZE = 24;

/** Nombres que no son un artista sino una colaboración puntual: «X feat. Y», «A, B, C & D». */
export function isSingleArtist(name: string): boolean {
  if (/\b(feat\.?|ft\.?|featuring)\s/i.test(name)) return false;
  return name.split(",").length < 3;
}

/** La portada de iTunes a 300×300 (llega a 600 o 100 según de dónde salga). */
export const smallCover = (url: string | null) => url?.replace(/\d+x\d+bb/, "300x300bb") ?? null;

/** El id del artista de una canción de iTunes (sin él, en búsquedas viejas de la caché, se usa su nombre). */
const itunesArtistId = (t: Track) => (t.artistIds[0] ? `itunes:${t.artistIds[0]}` : `itunes:name:${plain(t.artists[0] ?? "")}`);

/**
 * Artistas a partir de búsquedas de canciones: en el orden en que aparecen (la tienda ordena por relevancia, así que
 * los más conocidos salen antes), intercalando las búsquedas para que un género no tape a otro, sin repetir y sin
 * colaboraciones puntuales. La imagen es la portada de su primera canción.
 */
export function artistsFromTracks(groups: { genre: string | null; tracks: Track[] }[]): DirectoryArtist[] {
  const lists = groups.map(({ genre, tracks }) => tracks.filter((t) => matchesStoreGenre(t, genre)));
  // «A & B»: un dúo de verdad (Wisin & Yandel) tiene varias canciones; una colaboración suelta, una.
  const songsBy = new Map<string, number>();
  for (const t of lists.flat()) songsBy.set(itunesArtistId(t), (songsBy.get(itunesArtistId(t)) ?? 0) + 1);
  const isDuoOrSolo = (t: Track) => !/\s(&|y|x)\s/i.test(t.artists[0]) || (songsBy.get(itunesArtistId(t)) ?? 0) >= 2;
  const seen = new Set<string>();
  const out: DirectoryArtist[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const t = list[i];
      const name = t?.artists[0];
      if (!t || !name || !isSingleArtist(name) || !isDuoOrSolo(t) || seen.has(itunesArtistId(t))) continue;
      seen.add(itunesArtistId(t));
      out.push({ id: itunesArtistId(t), name, image: smallCover(t.albumImage) });
    }
  }
  return out;
}

const sourceOf = (a: DirectoryArtist) => a.id.slice(0, a.id.indexOf(":"));

/**
 * Intercala varias listas de artistas (una por género) sin repetir: el mismo id una sola vez y, entre fuentes
 * distintas (Spotify y el relleno de iTunes), el mismo nombre una sola vez. Dentro de una misma fuente, dos artistas
 * que se llaman igual pero son distintos se quedan los dos.
 */
export function interleave(lists: DirectoryArtist[][]): DirectoryArtist[] {
  const seenIds = new Set<string>();
  const sourcesByName = new Map<string, string>();
  const out: DirectoryArtist[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const a = list[i];
      if (!a || seenIds.has(a.id)) continue;
      const other = sourcesByName.get(plain(a.name));
      if (other && other !== sourceOf(a)) continue;
      seenIds.add(a.id);
      sourcesByName.set(plain(a.name), sourceOf(a));
      out.push(a);
    }
  }
  return out;
}

/** Una página de una lista completa. */
export function paginate<T>(items: T[], page: number, size = ARTISTS_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, hasMore: current < pages };
}
