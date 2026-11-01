import { AppError } from "@/lib/errors";
import type { Track } from "@/lib/spotify/types";
import type { ChosenArtist, GameFilters } from "./filters";
import { byArtist, byPopularity, plain, seedsOf } from "./seeds";
import { resolveMarket, type PickedTrack } from "./track-picker";

/** Búsqueda en la tienda: por texto, o solo por nombre de artista (`artistTerm`). */
export interface OpenSearch {
  term: string;
  country: string;
  attribute?: "artistTerm";
}

/** Buscador de canciones con vista previa (la real es iTunes; los tests usan una falsa). */
export interface OpenTrackSource {
  search(p: OpenSearch): Promise<Track[]>;
}

/** Tienda por defecto si no se eligió idioma. */
export const DEFAULT_COUNTRY = "US";

/**
 * Sin género ni palabra clave hace falta algún término: palabras muy comunes en canciones
 * del idioma elegido, para que salgan éxitos variados.
 */
export const COMMON_TERMS: Record<string, string[]> = {
  es: ["amor", "corazón", "noche", "baila", "vida", "fiesta", "te quiero", "bailar"],
  "es-latam": ["amor", "corazón", "noche", "baila", "vida", "fiesta", "te quiero", "bailar"],
  en: ["love", "baby", "night", "heart", "dance", "girl", "party", "forever"],
  pt: ["amor", "coração", "saudade", "noite", "você"],
  fr: ["amour", "nuit", "coeur", "danse"],
  it: ["amore", "notte", "cuore", "ballo"],
  de: ["liebe", "nacht", "herz", "tanz"],
  ko: ["love", "사랑", "dance"],
  ja: ["love", "恋", "夜"],
};

export interface OpenPickOptions {
  filters: GameFilters;
  usedTrackIds: Set<string>;
  source: OpenTrackSource;
  random?: () => number;
  maxAttempts?: number;
}

function pickFrom<T>(items: T[], random: () => number): T | undefined {
  return items.length ? items[Math.floor(random() * items.length)] : undefined;
}

/** Palabras comunes en canciones del idioma (para buscar cuando no hay ni género ni palabra clave). */
export const commonTerms = (language: string | undefined) => COMMON_TERMS[language ?? "en"] ?? COMMON_TERMS.en;

/**
 * Qué buscar: un artista elegido al azar (solo por su nombre), un género (más las palabras clave), las palabras
 * clave o una palabra común del idioma.
 */
export function buildOpenTerm(
  filters: GameFilters,
  random: () => number = Math.random,
): { term: string; genre: string | null; artist: ChosenArtist | null; attribute?: "artistTerm" } {
  const seed = pickFrom(seedsOf(filters), random);
  const keywords = filters.keywords?.trim();
  if (seed?.kind === "artist")
    return { term: seed.value, genre: null, artist: { id: seed.id, name: seed.value }, attribute: "artistTerm" };
  if (seed) return { term: [seed.value, keywords].filter(Boolean).join(" "), genre: seed.value, artist: null };
  if (keywords) return { term: keywords, genre: null, artist: null };
  return { term: pickFrom(commonTerms(filters.language), random)!, genre: null, artist: null };
}

/** Géneros tropicales: en la tienda salen como «Salsa y tropical», «Música tropical»… o como latino a secas. */
const TROPICAL_GENRES = new Set(["salsa", "merengue", "bachata", "cumbia", "vallenato"]);
/** Nombres genéricos de la tienda que también valen para un género tropical (no «Urbano latino» ni «Pop Latino»). */
const GENERIC_LATIN = new Set(["latin", "latino", "latina", "musica latina", "musica tropical"]);

/**
 * ¿La canción es del género pedido según la tienda? El género se busca como texto, así que también salen
 * canciones que solo lo llevan en el título («Salsa Tártara», de rap). De momento solo se comprueban los
 * tropicales, donde se vio el problema; sin dato de la tienda se da por buena.
 */
export function matchesStoreGenre(track: Track, genre: string | null): boolean {
  if (!genre || !TROPICAL_GENRES.has(genre) || !track.storeGenre) return true;
  const store = plain(track.storeGenre);
  return store.includes("tropical") || store.includes(genre) || GENERIC_LATIN.has(store);
}

function inYearRange(track: Track, filters: GameFilters): boolean {
  if (!filters.yearFrom && !filters.yearTo) return true;
  if (!track.releaseYear) return false;
  return (!filters.yearFrom || track.releaseYear >= filters.yearFrom) && (!filters.yearTo || track.releaseYear <= filters.yearTo);
}

/**
 * Elige una canción con vista previa de 30 s para el modo abierto. La vista previa es siempre
 * el mismo trozo, así que el fragmento empieza en 0.
 */
export async function pickOpenTrack(opts: OpenPickOptions): Promise<PickedTrack> {
  const random = opts.random ?? Math.random;
  const country = resolveMarket(opts.filters) ?? DEFAULT_COUNTRY;
  const maxAttempts = opts.maxAttempts ?? 4;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { term, genre, artist, attribute } = buildOpenTerm(opts.filters, random);
    const results = await opts.source.search({ term, country, attribute });
    const eligible = results.filter(
      (t) =>
        !!t.previewUrl &&
        !opts.usedTrackIds.has(t.id) &&
        inYearRange(t, opts.filters) &&
        matchesStoreGenre(t, genre) &&
        // Buscando un artista, la tienda también trae colaboraciones de otros y nombres parecidos.
        (!artist || byArtist(t, artist, "itunes")),
    );
    // La tienda ordena por relevancia: los éxitos arriba.
    const track = pickFrom(byPopularity(eligible, opts.filters.popularity), random);
    if (track) {
      const label = attribute ? `artista ${term}` : term;
      return { track, startMs: 0, genre, audioUrl: track.previewUrl, via: `itunes: ${label} (${country}) ${opts.filters.popularity}` };
    }
  }

  throw new AppError("NO_TRACKS_FOUND", 404);
}
