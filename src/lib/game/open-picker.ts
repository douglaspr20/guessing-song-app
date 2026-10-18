import { AppError } from "@/lib/errors";
import type { Track } from "@/lib/spotify/types";
import type { GameFilters } from "./filters";
import { resolveMarket, type PickedTrack } from "./track-picker";

/** Buscador de canciones con vista previa (la real es iTunes; los tests usan una falsa). */
export interface OpenTrackSource {
  search(p: { term: string; country: string }): Promise<Track[]>;
}

/** Tienda por defecto si no se eligió idioma. */
const DEFAULT_COUNTRY = "US";

/**
 * Sin género ni palabra clave hace falta algún término: palabras muy comunes en canciones
 * del idioma elegido, para que salgan éxitos variados.
 */
const COMMON_TERMS: Record<string, string[]> = {
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

/** Término de búsqueda: un género al azar (más las palabras clave), las palabras clave o una palabra común. */
export function buildOpenTerm(filters: GameFilters, random: () => number = Math.random): { term: string; genre: string | null } {
  const genre = pickFrom(filters.genres, random) ?? null;
  const keywords = filters.keywords?.trim();
  if (genre) return { term: [genre, keywords].filter(Boolean).join(" "), genre };
  if (keywords) return { term: keywords, genre: null };
  const words = COMMON_TERMS[filters.language ?? "en"] ?? COMMON_TERMS.en;
  return { term: pickFrom(words, random)!, genre: null };
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
    const { term, genre } = buildOpenTerm(opts.filters, random);
    const results = await opts.source.search({ term, country });
    const candidates = results.filter(
      (t) => !!t.previewUrl && !opts.usedTrackIds.has(t.id) && inYearRange(t, opts.filters),
    );
    const track = pickFrom(candidates, random);
    if (track) return { track, startMs: 0, genre, audioUrl: track.previewUrl };
  }

  throw new AppError(
    "No encontré canciones con vista previa para esos filtros. Prueba con otro género, años o palabra clave.",
    404,
    "NO_TRACKS_FOUND",
  );
}
