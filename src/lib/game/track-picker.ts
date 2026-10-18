import { AppError } from "@/lib/errors";
import { marketForLanguage } from "@/lib/spotify/catalog";
import type { Page, Track } from "@/lib/spotify/types";
import type { GameFilters } from "./filters";

/** Fuente de pistas inyectable (la real usa la Web API; los tests usan una falsa). */
export interface TrackSource {
  search(p: { q: string; market?: string; offset: number; limit: number }): Promise<Page<Track>>;
  playlist(p: { playlistId: string; market?: string; offset: number; limit: number }): Promise<Page<Track>>;
}

export interface PickOptions {
  filters: GameFilters;
  fragmentMs: number;
  /** Ids de pistas ya usadas en la partida (no se repiten). */
  usedTrackIds: Set<string>;
  source: TrackSource;
  random?: () => number;
  searchPageSize?: number;
  playlistPageSize?: number;
  maxSearchOffset?: number;
  maxAttempts?: number;
}

export interface PickedTrack {
  track: Track;
  startMs: number;
  /** Género del filtro con el que se encontró (para la pista); `null` si no se buscó por género. */
  genre: string | null;
}

/** Margen al final de la canción para que el fragmento no se quede sin audio. */
const END_MARGIN_MS = 5_000;
/** Por defecto el fragmento empieza a partir del 20 % para saltar intros largas. */
const MIN_START_FRACTION = 0.2;

export function resolveMarket(filters: GameFilters): string | undefined {
  return filters.market ?? marketForLanguage(filters.language);
}

/** Construye la query de /search, p. ej. `genre:"latin pop" year:1990-1999 mana`. */
export function buildSearchQuery(filters: GameFilters, genre: string | undefined): string {
  const parts: string[] = [];
  if (genre) parts.push(`genre:"${genre.replace(/"/g, "")}"`);
  if (filters.yearFrom || filters.yearTo) {
    const from = filters.yearFrom ?? 1900;
    const to = filters.yearTo ?? new Date().getFullYear();
    parts.push(from === to ? `year:${from}` : `year:${from}-${to}`);
  }
  if (filters.keywords) parts.push(filters.keywords);
  // Spotify exige texto en `q`; si no hay filtros, una vocal devuelve casi todo el catálogo.
  return parts.length ? parts.join(" ") : randomLetter();
}

function randomLetter(random: () => number = Math.random) {
  return "aeiou"[Math.floor(random() * 5)];
}

export function isEligible(track: Track, opts: Pick<PickOptions, "fragmentMs" | "usedTrackIds" | "filters">): boolean {
  if (opts.usedTrackIds.has(track.id)) return false;
  if (track.isPlayable === false) return false;
  if (track.durationMs < opts.fragmentMs + END_MARGIN_MS) return false;
  const minPop = opts.filters.minPopularity;
  if (minPop !== undefined && track.popularity !== null && track.popularity < minPop) return false;
  return true;
}

/** Punto de inicio aleatorio, normalmente entre el 20 % y (duración − fragmento − margen). */
export function computeStartMs(durationMs: number, fragmentMs: number, random: () => number = Math.random): number {
  const latest = durationMs - fragmentMs - END_MARGIN_MS;
  if (latest <= 0) return 0;
  const earliest = Math.min(Math.floor(durationMs * MIN_START_FRACTION), latest);
  return Math.floor(earliest + random() * (latest - earliest));
}

function randomInt(maxExclusive: number, random: () => number) {
  return Math.floor(random() * Math.max(1, maxExclusive));
}

function pickFrom<T>(items: T[], random: () => number): T | undefined {
  return items.length ? items[randomInt(items.length, random)] : undefined;
}

/**
 * Elige una pista que cumpla los filtros y no se haya usado.
 * Estrategia: pide la primera página para conocer el total y luego salta a páginas
 * aleatorias, reintentando hasta `maxAttempts` veces.
 */
export async function pickTrack(opts: PickOptions): Promise<PickedTrack> {
  const random = opts.random ?? Math.random;
  const maxAttempts = opts.maxAttempts ?? 6;
  const market = resolveMarket(opts.filters);
  const { filters } = opts;

  // Total conocido por "fuente" (cada género o playlist) para elegir offsets válidos.
  const totals = new Map<string, number>();
  // Playlists que Spotify deja leer (las de otras personas pueden dar 403 y se descartan).
  const playlists = [...filters.playlistIds];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let page: Page<Track>;
    let key: string;
    let genre: string | null = null;

    if (filters.source === "playlists") {
      const playlistId = pickFrom(playlists, random)!;
      const limit = opts.playlistPageSize ?? 50;
      key = `pl:${playlistId}`;
      const total = totals.get(key);
      const offset = total === undefined ? 0 : randomInt(Math.ceil(total / limit), random) * limit;
      // Primera vez: si la playlist es grande, la siguiente vuelta ya irá a una página aleatoria.
      try {
        page = await opts.source.playlist({ playlistId, market, offset, limit });
      } catch (err) {
        if (!(err instanceof AppError) || err.status !== 403) throw err;
        playlists.splice(playlists.indexOf(playlistId), 1);
        if (!playlists.length) {
          throw new AppError(
            "Spotify no deja leer las playlists elegidas: solo permite tus propias playlists y «Canciones que te gustan». Copia las canciones a una playlist tuya.",
            403,
            "PLAYLISTS_FORBIDDEN",
          );
        }
        attempt--; // una playlist bloqueada no gasta intento
        continue;
      }
    } else {
      genre = pickFrom(filters.genres, random) ?? null;
      const limit = opts.searchPageSize ?? 10;
      const q = buildSearchQuery(filters, genre ?? undefined);
      key = `q:${q}`;
      const total = totals.get(key);
      const maxOffset = Math.min(total ?? 0, opts.maxSearchOffset ?? 1000) - limit;
      const offset = total === undefined || maxOffset <= 0 ? 0 : randomInt(maxOffset + 1, random);
      page = await opts.source.search({ q, market, offset, limit });
    }

    const firstVisit = !totals.has(key);
    totals.set(key, page.total);

    const candidates = page.items.filter((t) => isEligible(t, opts));
    // En la primera visita a una fuente grande preferimos saltar a una página aleatoria
    // para no sacar siempre las mismas canciones de la página 1.
    const pageSize = filters.source === "playlists" ? (opts.playlistPageSize ?? 50) : (opts.searchPageSize ?? 10);
    const shouldJump = firstVisit && page.total > pageSize * 2 && attempt < maxAttempts - 1;
    if (candidates.length && !shouldJump) {
      const track = pickFrom(candidates, random)!;
      return { track, startMs: computeStartMs(track.durationMs, opts.fragmentMs, random), genre };
    }
    if (page.total === 0 && filters.source === "search" && filters.genres.length <= 1) break;
  }

  throw new AppError(
    "No encontré canciones nuevas con esos filtros. Prueba con otros géneros, años o playlists.",
    404,
    "NO_TRACKS_FOUND",
  );
}
