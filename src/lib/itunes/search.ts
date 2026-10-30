import "server-only";
import { AppError } from "@/lib/errors";
import type { Track } from "@/lib/spotify/types";

const SEARCH_URL = "https://itunes.apple.com/search";
/** Máximo que permite la API de búsqueda de iTunes. */
export const ITUNES_PAGE_SIZE = 200;

interface ItunesSong {
  kind?: string;
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  primaryGenreName?: string;
}

/** Pasa un resultado de iTunes a `Track`; descarta lo que no sea una canción con vista previa. */
export function normalizeItunesSong(s: ItunesSong): Track | null {
  if (s.kind !== "song" || !s.previewUrl || !s.trackName) return null;
  const year = s.releaseDate ? new Date(s.releaseDate).getUTCFullYear() : null;
  return {
    id: `itunes:${s.trackId}`,
    uri: `itunes:track:${s.trackId}`,
    name: s.trackName,
    artists: [s.artistName],
    artistIds: [],
    durationMs: s.trackTimeMillis ?? 0,
    // La portada a mayor tamaño: iTunes acepta cambiar el sufijo de dimensiones.
    albumImage: s.artworkUrl100?.replace(/100x100bb/, "600x600bb") ?? null,
    popularity: null,
    isPlayable: true,
    previewUrl: s.previewUrl,
    releaseYear: Number.isFinite(year) ? year : null,
    storeGenre: s.primaryGenreName ?? null,
  };
}

/**
 * Busca canciones en la API pública de iTunes (sin clave). `country` es el código ISO de la
 * tienda, que también aproxima el idioma de los resultados.
 */
export async function searchSongs({ term, country }: { term: string; country: string }): Promise<Track[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("term", term);
  url.searchParams.set("country", country);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(ITUNES_PAGE_SIZE));

  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 403 || res.status === 429) {
    throw new AppError("ITUNES_RATE_LIMITED", 429);
  }
  if (!res.ok) throw new AppError("ITUNES_ERROR", 502, { detail: `iTunes ${res.status}` });
  const data = (await res.json()) as { results?: ItunesSong[] };
  return (data.results ?? []).map(normalizeItunesSong).filter((t): t is Track => t !== null);
}
