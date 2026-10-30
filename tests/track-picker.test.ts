import { describe, expect, it, vi } from "vitest";
import { gameFiltersSchema } from "@/lib/game/filters";
import { buildSearchQuery, computeStartMs, pickTrack, resolveMarket, type TrackSource } from "@/lib/game/track-picker";
import type { Track } from "@/lib/spotify/types";

const filters = (f: Record<string, unknown> = {}) => gameFiltersSchema.parse(f);

function track(id: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    uri: `spotify:track:${id}`,
    name: `Song ${id}`,
    artists: ["Artist"],
    artistIds: ["artist-1"],
    durationMs: 200_000,
    albumImage: null,
    popularity: 50,
    isPlayable: true,
    ...overrides,
  };
}

describe("buildSearchQuery", () => {
  it("combina género, años y palabras clave", () => {
    expect(buildSearchQuery(filters({ yearFrom: 1980, yearTo: 1989, keywords: "soda" }), "rock en espanol")).toBe(
      'genre:"rock en espanol" year:1980-1989 soda',
    );
  });
  it("usa un año exacto cuando coinciden", () => {
    expect(buildSearchQuery(filters({ yearFrom: 1995, yearTo: 1995 }), undefined)).toBe("year:1995");
  });
  it("nunca devuelve una query vacía", () => {
    expect(buildSearchQuery(filters(), undefined)).toMatch(/^[aeiou]$/);
  });
});

describe("resolveMarket", () => {
  it("prioriza el mercado explícito sobre el idioma", () => {
    expect(resolveMarket(filters({ language: "pt" }))).toBe("BR");
    expect(resolveMarket(filters({ language: "pt", market: "PT" }))).toBe("PT");
  });
});

describe("computeStartMs", () => {
  it("deja sitio para todo el fragmento", () => {
    for (const r of [0, 0.5, 0.999]) {
      const start = computeStartMs(240_000, 60_000, () => r);
      expect(start).toBeGreaterThanOrEqual(48_000); // 20 %
      expect(start + 60_000).toBeLessThanOrEqual(240_000 - 5_000);
    }
  });
  it("empieza en 0 si la canción es justa", () => {
    expect(computeStartMs(64_000, 60_000, () => 0.7)).toBe(0);
  });
});

describe("pickTrack", () => {
  it("descarta pistas usadas, cortas o no reproducibles", async () => {
    const source: TrackSource = {
      search: vi.fn(async () => ({
        items: [
          track("used"),
          track("short", { durationMs: 50_000 }),
          track("blocked", { isPlayable: false }),
          track("ok"),
        ],
        total: 4,
      })),
      playlist: vi.fn(),
    };
    const picked = await pickTrack({
      filters: filters({ genres: ["pop"] }),
      fragmentMs: 60_000,
      usedTrackIds: new Set(["used"]),
      source,
      random: () => 0.5,
    });
    expect(picked.track.id).toBe("ok");
    expect(picked.genre).toBe("pop");
  });

  it("salta a una página aleatoria cuando hay muchos resultados", async () => {
    const search = vi.fn(async ({ offset }: { offset: number }) => ({
      items: [track(`t${offset}`)],
      total: 500,
    }));
    const picked = await pickTrack({
      filters: filters({ genres: ["rock"] }),
      fragmentMs: 60_000,
      usedTrackIds: new Set(),
      source: { search, playlist: vi.fn() },
      random: () => 0.5,
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[1][0].offset).toBeGreaterThan(0);
    expect(picked.track.id).not.toBe("t0");
  });

  it("lee de playlists cuando la fuente es playlists", async () => {
    const playlist = vi.fn(async () => ({ items: [track("p1")], total: 1 }));
    const picked = await pickTrack({
      filters: filters({ source: "playlists", playlistIds: ["abc"] }),
      fragmentMs: 60_000,
      usedTrackIds: new Set(),
      source: { search: vi.fn(), playlist },
    });
    expect(playlist).toHaveBeenCalledWith(expect.objectContaining({ playlistId: "abc" }));
    expect(picked.track.id).toBe("p1");
    // En playlists no hay género de filtro; lo resuelve el servicio con el artista.
    expect(picked.genre).toBeNull();
  });

  it("falla con NO_TRACKS_FOUND si no hay candidatas", async () => {
    await expect(
      pickTrack({
        filters: filters({ genres: ["nada"] }),
        fragmentMs: 60_000,
        usedTrackIds: new Set(),
        source: { search: vi.fn(async () => ({ items: [], total: 0 })), playlist: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: "NO_TRACKS_FOUND" });
  });
});

describe("pickTrack con playlists bloqueadas", () => {
  it("salta las playlists que Spotify rechaza con 403", async () => {
    const { AppError } = await import("@/lib/errors");
    const playlist = vi.fn(async ({ playlistId }: { playlistId: string }) => {
      if (playlistId === "ajena") throw new AppError("SPOTIFY_API_ERROR", 403, { detail: "Spotify 403: Forbidden" });
      return { items: [track("mia-1")], total: 1 };
    });
    const picked = await pickTrack({
      filters: filters({ source: "playlists", playlistIds: ["ajena", "mia"] }),
      fragmentMs: 60_000,
      usedTrackIds: new Set(),
      source: { search: vi.fn(), playlist },
      random: () => 0, // elige primero "ajena"
    });
    expect(picked.track.id).toBe("mia-1");
  });

  it("explica el problema si todas están bloqueadas", async () => {
    const { AppError } = await import("@/lib/errors");
    await expect(
      pickTrack({
        filters: filters({ source: "playlists", playlistIds: ["ajena"] }),
        fragmentMs: 60_000,
        usedTrackIds: new Set(),
        source: {
          search: vi.fn(),
          playlist: vi.fn(async () => {
            throw new AppError("SPOTIFY_API_ERROR", 403, { detail: "Spotify 403: Forbidden" });
          }),
        },
      }),
    ).rejects.toMatchObject({ code: "PLAYLISTS_FORBIDDEN" });
  });
});

describe("pickTrack con géneros que Spotify no reconoce", () => {
  it("busca el género como palabra clave si el filtro genre: no devuelve nada", async () => {
    const search = vi.fn(async ({ q }: { q: string }) =>
      q.startsWith("genre:") ? { items: [], total: 0 } : { items: [track("salsa-1")], total: 1 },
    );
    const picked = await pickTrack({
      filters: filters({ genres: ["salsa"] }),
      fragmentMs: 60_000,
      usedTrackIds: new Set(),
      source: { search, playlist: vi.fn() },
    });
    expect(search.mock.calls[0][0].q).toBe('genre:"salsa"');
    expect(search.mock.calls[1][0].q).toBe("salsa");
    expect(picked.track.id).toBe("salsa-1");
    expect(picked.genre).toBe("salsa");
    expect(picked.via).toBe("texto: salsa @0");
  });

  it("con otros géneros que sí dan canciones, el vacío se deja de lado y nunca se busca como texto", async () => {
    // Partida en familia (octubre 2026): «rock en espanol» como texto trajo a un grupo country alemán.
    const search = vi.fn(async ({ q, offset }: { q: string; offset: number }) =>
      q.startsWith('genre:"salsa"') ? { items: [track(`salsa-${offset}`)], total: 0 } : { items: [], total: 0 },
    );
    for (const r of [0, 0.4, 0.99]) {
      const picked = await pickTrack({
        filters: filters({ genres: ["rock en espanol", "salsa"], yearFrom: 1970, yearTo: 2010 }),
        fragmentMs: 60_000,
        usedTrackIds: new Set(),
        source: { search, playlist: vi.fn() },
        random: () => r,
      });
      expect(picked.genre).toBe("salsa");
    }
    expect(search.mock.calls.every(([p]) => p.q.startsWith("genre:"))).toBe(true);
  });
});

describe("pickTrack cuando Spotify no da un total útil", () => {
  // Spotify a veces responde `total: 0` con la página llena (búsquedas por género con años, octubre de 2026).
  const pages = (perPage: number, pagesWithSongs: number) =>
    vi.fn(async ({ q, offset, limit }: { q: string; offset: number; limit: number }) => {
      if (!q.startsWith("genre:") || offset >= perPage * pagesWithSongs) return { items: [], total: 0 };
      return { items: Array.from({ length: Math.min(limit, perPage) }, (_, i) => track(`g${offset + i}`)), total: 0 };
    });

  it("con total 0 pero canciones en la página, no pasa a buscar el género como texto", async () => {
    const search = pages(10, 1);
    const picked = await pickTrack({
      filters: filters({ genres: ["salsa"], yearFrom: 1980, yearTo: 1989 }),
      fragmentMs: 60_000,
      usedTrackIds: new Set(),
      source: { search, playlist: vi.fn() },
      random: () => 0,
    });
    expect(search.mock.calls.every(([p]) => p.q === 'genre:"salsa" year:1980-1989')).toBe(true);
    expect(picked.track.id).toBe("g0");
    expect(picked.via).toBe('genre:"salsa" year:1980-1989 @0');
  });

  it("si la primera página ya se usó, avanza a la siguiente en vez de repetirla", async () => {
    const search = pages(10, 3);
    const used = new Set(Array.from({ length: 10 }, (_, i) => `g${i}`));
    const picked = await pickTrack({
      filters: filters({ genres: ["salsa"] }),
      fragmentMs: 60_000,
      usedTrackIds: used,
      source: { search, playlist: vi.fn() },
      random: () => 0,
    });
    expect(search.mock.calls.map(([p]) => p.offset)).toEqual([0, 10]);
    expect(picked.track.id).toBe("g10");
    expect(picked.via).toBe('genre:"salsa" @10');
  });

  it("al acabarse las páginas no salta a buscar texto: se rinde con NO_TRACKS_FOUND", async () => {
    const search = pages(10, 1);
    const used = new Set(Array.from({ length: 10 }, (_, i) => `g${i}`));
    await expect(
      pickTrack({
        filters: filters({ genres: ["salsa"] }),
        fragmentMs: 60_000,
        usedTrackIds: used,
        source: { search, playlist: vi.fn() },
        random: () => 0,
      }),
    ).rejects.toMatchObject({ code: "NO_TRACKS_FOUND" });
    expect(search.mock.calls.some(([p]) => !p.q.startsWith("genre:"))).toBe(false);
  });
});
