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
      if (playlistId === "ajena") throw new AppError("Spotify 403: Forbidden", 403, "SPOTIFY_API_ERROR");
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
            throw new AppError("Spotify 403: Forbidden", 403, "SPOTIFY_API_ERROR");
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
  });
});
