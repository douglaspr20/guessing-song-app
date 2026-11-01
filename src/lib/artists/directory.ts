import 'server-only';
import type { Owner } from '@/lib/access/owner';
import { db } from '@/lib/db';
import {
  commonTerms,
  DEFAULT_COUNTRY,
  type OpenTrackSource,
} from '@/lib/game/open-picker';
import { plain } from '@/lib/game/seeds';
import { marketForLanguage } from '@/lib/spotify/catalog';
import { SEARCH_PAGE_SIZE, type ArtistCard } from '@/lib/spotify/sources';
import type { Track } from '@/lib/spotify/types';
import {
  ARTISTS_PAGE_SIZE,
  artistsFromTracks,
  interleave,
  paginate,
  type DirectoryArtist,
} from './aggregate';

export interface ArtistQuery {
  /** `spotify` solo si la cuenta tiene Spotify conectado (lo comprueba la ruta). */
  source: 'itunes' | 'spotify';
  /** Cuenta cuyo Spotify se usa (con `source: "spotify"`). */
  userId?: string;
  genres: string[];
  language?: string;
  /** Época: solo artistas con canciones entre esos años (los dos incluidos). Solo iTunes: Spotify no filtra artistas por año. */
  yearFrom?: number;
  yearTo?: number;
  q?: string;
  page: number;
}

export interface ArtistPage {
  artists: DirectoryArtist[];
  page: number;
  /** Total de páginas, si se sabe (con Spotify no: solo si hay más). */
  pages: number | null;
  hasMore: boolean;
}

export interface ArtistSources {
  itunes: OpenTrackSource;
  spotify: (
    userId: string,
    p: { q: string; market?: string; offset: number; limit: number },
  ) => Promise<{ items: ArtistCard[] }>;
}

/** De dónde sale el directorio para este dueño: Spotify si puede usarlo y lo tiene conectado; si no, iTunes. */
export async function artistSourceFor(owner: Owner | null): Promise<ArtistQuery['source']> {
  if (owner?.kind !== 'user' || !owner.spotifyAllowed) return 'itunes';
  return (await db.spotifyAccount.count({ where: { userId: owner.userId } })) > 0 ? 'spotify' : 'itunes';
}

/** Peticiones al directorio por conexión: de sobra para hojear y buscar, pero frena a quien lo recorra en bucle. */
export const ARTISTS_LIMITS = { perIp: 120, windowMs: 10 * 60_000 };

/**
 * El listado de Spotify sin géneros: una categoría amplia que su filtro `genre:` sí entiende (medido el 31-10-2026:
 * «latin» y «pop» dan 100 artistas cada uno, ordenados por fama).
 */
export const broadGenreFor = (language: string | undefined) => (language?.startsWith('es') ? 'latin' : 'pop');

/** Cuántas palabras comunes del idioma se usan para el listado sin géneros (cada una es una búsqueda). */
const COMMON_TERMS_FOR_LIST = 3;

/**
 * El directorio de artistas para elegir con quién jugar.
 *
 * - **iTunes** (modo abierto, o sin Spotify): sale de las mismas búsquedas por género que hace el juego, que ya están
 *   en la caché; con buscador, de una búsqueda por nombre de artista. La imagen es la portada de su canción más conocida
 *   (la API pública de iTunes no da fotos de artista).
 * - **Spotify** (con la cuenta conectada): sus artistas con su foto oficial, ordenados por fama. Su filtro por género
 *   no conoce muchos géneros (p. ej. «rock en espanol» da 0): ese género se completa con iTunes.
 */
export async function listArtists(
  query: ArtistQuery,
  sources: ArtistSources,
): Promise<ArtistPage> {
  if (query.source === 'spotify' && query.userId)
    return spotifyArtists({ ...query, userId: query.userId }, sources);
  const all = await itunesArtists(query, sources.itunes);
  const { items, page, pages, hasMore } = paginate(all, query.page);
  return { artists: items, page, pages, hasMore };
}

type Years = Pick<ArtistQuery, 'yearFrom' | 'yearTo'>;

const hasYears = ({ yearFrom, yearTo }: Years) => yearFrom !== undefined || yearTo !== undefined;

/** Con época, solo cuentan las canciones de esos años (las que no dicen el año, fuera). */
function inYears(tracks: Track[], years: Years) {
  if (!hasYears(years)) return tracks;
  const { yearFrom = 0, yearTo = 9999 } = years;
  return tracks.filter((t) => t.releaseYear != null && t.releaseYear >= yearFrom && t.releaseYear <= yearTo);
}

/** Todos los artistas de iTunes para esos géneros (o ese nombre), en orden de fama. */
async function itunesArtists(
  { genres, language, q, yearFrom, yearTo }: Pick<ArtistQuery, 'genres' | 'language' | 'q' | 'yearFrom' | 'yearTo'>,
  itunes: OpenTrackSource,
) {
  const country = marketForLanguage(language) ?? DEFAULT_COUNTRY;
  const years = { yearFrom, yearTo };
  if (q?.trim()) {
    const tracks = inYears(
      await itunes.search({
        term: q.trim(),
        country,
        attribute: 'artistTerm',
      }),
      years,
    );
    // Buscando «Shakira», sus colaboraciones («Carlos Vives & Shakira») sobran: se quiere a ella.
    const wanted = plain(q);
    const collabOfWanted = (name: string) =>
      plain(name) !== wanted &&
      name.split(/\s*,\s*|\s(?:&|y|x)\s/i).some((part) => plain(part) === wanted);
    // Y quien solo canta con ella (nobigdyl., YK Osiris) tampoco: buscando por nombre, el nombre tiene que estar.
    return artistsFromTracks([{ genre: null, tracks }]).filter(
      (a) => plain(a.name).includes(wanted) && !collabOfWanted(a.name),
    );
  }
  const terms = genres.length
    ? genres.map((g) => ({ term: g, genre: g }))
    : commonTerms(language)
        .slice(0, COMMON_TERMS_FOR_LIST)
        .map((term) => ({ term, genre: null }));
  const groups = await Promise.all(
    terms.map(async ({ term, genre }) => ({
      genre,
      tracks: inYears(await itunes.search({ term, country }), years),
    })),
  );
  return artistsFromTracks(groups);
}

/** Lo que pide Spotify para cubrir `count` artistas desde `offset` (da como mucho 10 por llamada). */
async function spotifySlice(
  sources: ArtistSources,
  userId: string,
  q: string,
  market: string | undefined,
  offset: number,
  count: number,
) {
  const out: ArtistCard[] = [];
  for (let at = offset; at < offset + count; at += SEARCH_PAGE_SIZE) {
    const { items } = await sources.spotify(userId, {
      q,
      market,
      offset: at,
      limit: SEARCH_PAGE_SIZE,
    });

    out.push(...items);
    if (items.length < SEARCH_PAGE_SIZE)
      return { items: out.slice(0, count), more: false };
  }
  return { items: out.slice(0, count), more: true };
}

async function spotifyArtists(
  query: ArtistQuery & { userId: string },
  sources: ArtistSources,
): Promise<ArtistPage> {
  // La época no se aplica: el `year:` de Spotify no filtra artistas (con él no devuelve ninguno), y /artists no la
  // ofrece con Spotify.
  const { userId, genres, language, q, page } = query;
  const market = marketForLanguage(language);
  if (q?.trim() || !genres.length) {
    // Sin géneros ni buscador, una categoría amplia que Spotify sí conoce (con una letra suelta, como «a», devolvía
    // artistas que se llaman literalmente «A»).
    const { items, more } = await spotifySlice(
      sources,
      userId,
      q?.trim() || `genre:"${broadGenreFor(language)}"`,
      market,
      (page - 1) * ARTISTS_PAGE_SIZE,
      ARTISTS_PAGE_SIZE,
    );

    return { artists: items, page, pages: null, hasMore: more };
  }

  // Cada género aporta su parte de la página; los que Spotify no conoce se completan con iTunes.
  const perGenre = Math.ceil(ARTISTS_PAGE_SIZE / genres.length);
  const offset = (page - 1) * perGenre;
  let more = false;
  const lists = await Promise.all(
    genres.map(async (genre) => {
      const slice = await spotifySlice(
        sources,
        userId,
        `genre:"${genre.replace(/"/g, '')}"`,
        market,
        offset,
        perGenre,
      );
      if (slice.items.length) {
        more ||= slice.more;
        return slice.items;
      }
      // Vacío: o Spotify no conoce el género, o ya no hay más. Se mira la primera página para saberlo.
      const known =
        page > 1 &&
        (
          await sources.spotify(userId, {
            q: `genre:"${genre}"`,
            market,
            offset: 0,
            limit: 1,
          })
        ).items.length;
      if (known) return [];
      const fromItunes = await itunesArtists(
        { genres: [genre], language },
        sources.itunes,
      );
      more ||= fromItunes.length > offset + perGenre;
      return fromItunes.slice(offset, offset + perGenre);
    }),
  );
  return {
    artists: interleave(lists).slice(0, ARTISTS_PAGE_SIZE),
    page,
    pages: null,
    hasMore: more,
  };
}
