import { AppError } from "@/lib/errors";
import { marketForLanguage } from "@/lib/spotify/catalog";
import type { Page, Track } from "@/lib/spotify/types";
import type { GameFilters, Popularity } from "./filters";
import { byArtist, POPULARITY_WINDOW, seedsOf, type Seed } from "./seeds";

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
  /** Audio a reproducir en el navegador (modo abierto); sin él suena por Spotify. */
  audioUrl?: string | null;
  /** De qué búsqueda salió, p. ej. `genre:"salsa" year:1980-1989 @20` (se guarda en la ronda para poder revisarlo). */
  via?: string;
}

/** Margen al final de la canción para que el fragmento no se quede sin audio. */
const END_MARGIN_MS = 5_000;
/** Por defecto el fragmento empieza a partir del 20 % para saltar intros largas. */
const MIN_START_FRACTION = 0.2;

export function resolveMarket(filters: GameFilters): string | undefined {
  return filters.market ?? marketForLanguage(filters.language);
}

/** Construye la query de /search, p. ej. `genre:"latin pop" year:1990-1999 mana` o `artist:"Juanes" year:2000`. */
export function buildSearchQuery(filters: GameFilters, seed: Seed | string | undefined): string {
  const parts: string[] = [];
  const s: Seed | undefined = typeof seed === "string" ? { kind: "genre", value: seed } : seed;
  if (s) parts.push(`${s.kind}:"${s.value.replace(/"/g, "")}"`);
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

/** Lo que se sabe de una búsqueda: el total que dice Spotify, hasta dónde se ha leído y si ya no hay más. */
interface SearchProgress {
  total: number;
  next: number;
  done: boolean;
}

/**
 * Offset de la siguiente página de una búsqueda. Si Spotify dice que hay muchas, se salta a una página al
 * azar. Su `total` ya no es fiable (a veces dice 0 con la página llena), así que si no, se avanza página
 * a página mientras haya canciones y, cuando se acaban, se vuelve a una ya vista.
 */
function nextSearchOffset(p: SearchProgress | undefined, limit: number, maxOffset: number, random: () => number, minOffset = 0) {
  if (!p) return minOffset;
  const top = Math.min(p.total, maxOffset) - limit;
  if (p.total > limit * 2 && top > minOffset) return minOffset + randomInt(top - minOffset + 1, random);
  if (!p.done) return p.next;
  return minOffset + randomInt(Math.max(1, Math.ceil((p.next - minOffset) / limit)), random) * limit;
}

/**
 * Qué zona de los resultados se mira según la popularidad: Spotify ordena por relevancia (los éxitos primero) y ya
 * no da su cifra de popularidad. Éxitos: solo las primeras páginas. Joyas: a partir de las primeras 60.
 */
export function offsetWindow(popularity: Popularity, maxOffset: number) {
  if (popularity === "hits") return { minOffset: 0, maxOffset: Math.min(maxOffset, POPULARITY_WINDOW.hits) };
  if (popularity === "gems") return { minOffset: POPULARITY_WINDOW.gemsFrom, maxOffset };
  return { minOffset: 0, maxOffset };
}

/**
 * Elige una pista que cumpla los filtros y no se haya usado.
 * Estrategia: pide la primera página y luego salta a páginas aleatorias (o avanza página a página si
 * Spotify no da un total útil), reintentando hasta `maxAttempts` veces.
 */
export async function pickTrack(opts: PickOptions): Promise<PickedTrack> {
  const random = opts.random ?? Math.random;
  const maxAttempts = opts.maxAttempts ?? 6;
  const market = resolveMarket(opts.filters);
  const { filters } = opts;

  // Total conocido por playlist para elegir offsets válidos.
  const totals = new Map<string, number>();
  // Lo leído de cada búsqueda (cada género).
  const searches = new Map<string, SearchProgress>();
  // Playlists que Spotify deja leer (las de otras personas pueden dar 403 y se descartan).
  const playlists = [...filters.playlistIds];
  // Géneros o artistas con los que la búsqueda no devuelve ni una canción: se dejan de lado mientras otros funcionen.
  const emptySeeds = new Set<string>();
  const seeds = seedsOf(filters);
  const popularity = filters.popularity ?? "mix";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let page: Page<Track>;
    let key: string;
    let genre: string | null = null;
    let artist: { id: string; name: string } | null = null;
    let via: string;
    let firstVisit: boolean;

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
          throw new AppError("PLAYLISTS_FORBIDDEN", 403);
        }
        attempt--; // una playlist bloqueada no gasta intento
        continue;
      }
      firstVisit = total === undefined;
      totals.set(key, page.total);
      via = `playlist:${playlistId} @${offset}`;
    } else {
      // Buscar un género como texto libre trae cualquier cosa que lleve esas palabras: con «rock en espanol»
      // salió un grupo country alemán ronda tras ronda. Solo se hace si ningún género elegido da canciones (nunca
      // con artistas: un artista sin canciones simplemente no cuenta).
      const working = seeds.filter((s) => !emptySeeds.has(`${s.kind}:${s.value}`));
      const asText = seeds.length > 0 && !working.length && seeds[0].kind === "genre";
      if (seeds.length && !working.length && !asText) break;
      const seed = pickFrom(asText ? seeds : working, random);
      genre = seed?.kind === "genre" ? seed.value : null;
      artist = seed?.kind === "artist" ? { id: seed.id, name: seed.value } : null;
      const limit = opts.searchPageSize ?? 10;
      const window = offsetWindow(popularity, opts.maxSearchOffset ?? 1000);
      const q = asText
        ? buildSearchQuery({ ...filters, keywords: [genre, filters.keywords].filter(Boolean).join(" ") }, undefined)
        : buildSearchQuery(filters, seed);
      key = `q:${q}`;
      const progress = searches.get(key);
      const offset = nextSearchOffset(progress, limit, window.maxOffset, random, window.minOffset);
      page = await opts.source.search({ q, market, offset, limit });
      if (!page.items.length && !progress && seed && !asText) {
        // Se mira la página y no `total`: Spotify a veces dice 0 con la página llena. Con «joyas» es la zona
        // de abajo la que no tiene nada: tampoco sirve (si no queda ninguna, el respaldo afloja la popularidad).
        emptySeeds.add(`${seed.kind}:${seed.value}`);
        attempt--; // no gasta intento
        continue;
      }
      firstVisit = !progress;
      const seenTo = offset + page.items.length;
      searches.set(key, {
        total: page.total,
        next: Math.max(progress?.next ?? 0, seenTo),
        done: page.items.length < limit || seenTo >= window.maxOffset,
      });
      via = `${asText ? "texto: " : ""}${q} @${offset} ${popularity}`;
    }

    // Con un artista elegido, solo canciones suyas (Spotify también trae nombres parecidos y colaboraciones ajenas).
    const candidates = page.items.filter((t) => isEligible(t, opts) && (!artist || byArtist(t, artist, "spotify")));
    // En la primera visita a una fuente grande preferimos saltar a una página aleatoria
    // para no sacar siempre las mismas canciones de la página 1.
    const pageSize = filters.source === "playlists" ? (opts.playlistPageSize ?? 50) : (opts.searchPageSize ?? 10);
    // Con «éxitos» no se salta: lo bueno está justo en las primeras páginas.
    const shouldJump = firstVisit && page.total > pageSize * 2 && attempt < maxAttempts - 1 && popularity !== "hits";
    if (candidates.length && !shouldJump) {
      const track = pickFrom(candidates, random)!;
      return { track, startMs: computeStartMs(track.durationMs, opts.fragmentMs, random), genre, via };
    }
    if (!page.items.length && filters.source === "search" && seeds.length <= 1 && !searches.get(key)?.next) break;
  }

  throw new AppError("NO_TRACKS_FOUND", 404, { key: "NO_NEW_TRACKS" });
}
