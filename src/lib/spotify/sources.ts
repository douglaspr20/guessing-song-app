import "server-only";
import { AppError } from "@/lib/errors";
import { spotifyFetch } from "./client";
import type { Page, PlaylistSummary, SpotifyTrackObject, Track } from "./types";

/**
 * Tamaño de página para /search. En modo desarrollo Spotify limita mucho el máximo,
 * así que pedimos poco y paginamos con offsets aleatorios.
 */
export const SEARCH_PAGE_SIZE = 10;
/** Spotify no permite offsets de búsqueda por encima de este valor. */
export const SEARCH_MAX_OFFSET = 1000;
export const PLAYLIST_PAGE_SIZE = 50;
/** Id especial para usar "Canciones que te gustan" como si fuera una playlist más. */
export const LIKED_TRACKS_ID = "liked";

export function normalizeTrack(t: SpotifyTrackObject): Track | null {
  // Ignora episodios de podcast, archivos locales y pistas sin id.
  if (!t?.id || t.is_local || (t.type && t.type !== "track")) return null;
  const images = t.album?.images ?? [];
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    artistIds: t.artists.map((a) => a.id).filter((id): id is string => !!id),
    durationMs: t.duration_ms,
    albumImage: images[0]?.url ?? null,
    popularity: typeof t.popularity === "number" ? t.popularity : null,
    isPlayable: typeof t.is_playable === "boolean" ? t.is_playable : null,
  };
}

export async function searchTracks(userId: string, params: {
  q: string;
  market?: string;
  offset?: number;
  limit?: number;
}): Promise<Page<Track>> {
  const data = await spotifyFetch<{ tracks: { items: SpotifyTrackObject[]; total: number } }>(userId, "/search", {
    query: {
      q: params.q,
      type: "track",
      market: params.market,
      limit: params.limit ?? SEARCH_PAGE_SIZE,
      offset: params.offset ?? 0,
    },
  });
  return {
    items: data.tracks.items.map(normalizeTrack).filter((t): t is Track => t !== null),
    total: data.tracks.total,
  };
}

interface PlaylistEntry {
  // Respuesta nueva (/items) usa `item`; la antigua (/tracks) usa `track`.
  item?: SpotifyTrackObject | null;
  track?: SpotifyTrackObject | null;
}

/** Lee una página de "Canciones que te gustan" (biblioteca del usuario, no es una playlist en la API). */
export async function getLikedTracks(
  userId: string,
  params: { offset?: number; limit?: number; market?: string } = {},
): Promise<Page<Track>> {
  const data = await spotifyFetch<{ items: { track: SpotifyTrackObject | null }[]; total: number }>(userId, "/me/tracks", {
    query: { offset: params.offset ?? 0, limit: params.limit ?? PLAYLIST_PAGE_SIZE, market: params.market },
  });
  return {
    items: data.items
      .map((e) => (e.track ? normalizeTrack(e.track) : null))
      .filter((t): t is Track => t !== null),
    total: data.total,
  };
}

/** Lee una página de una playlist. Intenta /items y cae a /tracks si la API es la antigua. */
export async function getPlaylistTracks(
  userId: string,
  playlistId: string,
  params: { offset?: number; limit?: number; market?: string } = {},
): Promise<Page<Track>> {
  if (playlistId === LIKED_TRACKS_ID) return getLikedTracks(userId, params);
  const query = {
    offset: params.offset ?? 0,
    limit: params.limit ?? PLAYLIST_PAGE_SIZE,
    market: params.market,
  };
  const id = encodeURIComponent(playlistId);
  let data: { items: PlaylistEntry[]; total: number };
  try {
    data = await spotifyFetch(userId, `/playlists/${id}/items`, { query });
  } catch (err) {
    if (!(err instanceof AppError) || err.status !== 404) throw err;
    data = await spotifyFetch(userId, `/playlists/${id}/tracks`, { query });
  }
  return {
    items: data.items
      .map((e) => e.item ?? e.track)
      .filter((t): t is SpotifyTrackObject => !!t)
      .map(normalizeTrack)
      .filter((t): t is Track => t !== null),
    total: data.total,
  };
}

async function likedTracksSummary(userId: string): Promise<PlaylistSummary> {
  const summary = { id: LIKED_TRACKS_ID, name: "Canciones que te gustan", owner: "", image: null, readable: true };
  try {
    const { total } = await getLikedTracks(userId, { limit: 1 });
    return { ...summary, totalTracks: total };
  } catch (err) {
    // Sesiones iniciadas antes de pedir `user-library-read` reciben 401/403.
    if (err instanceof AppError && (err.status === 401 || err.status === 403)) {
      return { ...summary, totalTracks: null, needsReconnect: true };
    }
    throw err;
  }
}

/**
 * Playlists del usuario conectado, con "Canciones que te gustan" primero. Incluye las que solo
 * sigue, marcadas como no legibles: Spotify (modo desarrollo) no deja leer sus canciones.
 */
export async function getMyPlaylists(userId: string): Promise<PlaylistSummary[]> {
  const [liked, me] = await Promise.all([likedTracksSummary(userId), spotifyFetch<{ id: string }>(userId, "/me")]);
  const result: PlaylistSummary[] = [liked];
  let offset = 0;
  // Máximo 4 páginas (200 playlists) para no eternizarnos.
  for (let page = 0; page < 4; page++) {
    const data = await spotifyFetch<{
      items: ({
        id: string;
        name: string;
        owner?: { id?: string; display_name?: string | null };
        collaborative?: boolean;
        tracks?: { total?: number };
        items?: { total?: number };
        images?: { url: string }[] | null;
      } | null)[];
      next: string | null;
    }>(userId, "/me/playlists", { query: { limit: 50, offset } });

    for (const p of data.items) {
      if (!p) continue;
      result.push({
        id: p.id,
        name: p.name,
        owner: p.owner?.display_name ?? "",
        totalTracks: p.items?.total ?? p.tracks?.total ?? null,
        image: p.images?.[0]?.url ?? null,
        readable: p.owner?.id === me.id || !!p.collaborative,
      });
    }
    if (!data.next) break;
    offset += 50;
  }
  // Primero las que se pueden usar.
  return [result[0], ...result.slice(1).sort((a, b) => Number(b.readable) - Number(a.readable))];
}

export interface SpotifyProfile {
  id: string;
  displayName: string | null;
  /** `null` si Spotify no devuelve el tipo de cuenta. */
  premium: boolean | null;
  country: string | null;
}

type MeResponse = { id: string; display_name?: string | null; product?: string; country?: string };

function toProfile(me: MeResponse): SpotifyProfile {
  return {
    id: me.id,
    displayName: me.display_name ?? null,
    premium: me.product ? me.product === "premium" : null,
    country: me.country ?? null,
  };
}

export async function getMe(userId: string): Promise<SpotifyProfile> {
  return toProfile(await spotifyFetch<MeResponse>(userId, "/me"));
}

/**
 * Perfil con un token recién canjeado, antes de guardarlo. En modo desarrollo Spotify responde 403
 * a las cuentas que no están en la lista del panel: lo traducimos a SPOTIFY_NOT_ALLOWED.
 */
export async function getMeWithToken(accessToken: string): Promise<SpotifyProfile> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 403) {
    throw new AppError("Esta cuenta de Spotify no está autorizada en la app", 403, "SPOTIFY_NOT_ALLOWED");
  }
  if (!res.ok) throw new AppError(`Spotify ${res.status} al leer el perfil`, 502, "SPOTIFY_API_ERROR");
  return toProfile(await res.json());
}
