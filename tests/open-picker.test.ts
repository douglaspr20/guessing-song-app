import { describe, expect, it, vi } from "vitest";
import { gameFiltersSchema } from "@/lib/game/filters";
import { buildOpenTerm, pickOpenTrack, type OpenTrackSource } from "@/lib/game/open-picker";
import type { Track } from "@/lib/spotify/types";

const filters = (f: Record<string, unknown> = {}) => gameFiltersSchema.parse(f);

function song(id: string, patch: Partial<Track> = {}): Track {
  return {
    id,
    uri: `itunes:track:${id}`,
    name: `Song ${id}`,
    artists: ["Artist"],
    artistIds: [],
    durationMs: 200_000,
    albumImage: null,
    popularity: null,
    isPlayable: true,
    previewUrl: `https://audio.example/${id}.m4a`,
    releaseYear: 1995,
    ...patch,
  };
}

describe("buildOpenTerm", () => {
  it("usa un género (con las palabras clave) si se eligió alguno", () => {
    expect(buildOpenTerm(filters({ genres: ["salsa"], keywords: "lavoe" }))).toEqual({ term: "salsa lavoe", genre: "salsa" });
  });
  it("usa las palabras clave si no hay género", () => {
    expect(buildOpenTerm(filters({ keywords: "soda stereo" }))).toEqual({ term: "soda stereo", genre: null });
  });
  it("sin filtros usa una palabra común del idioma", () => {
    expect(buildOpenTerm(filters({ language: "es" }), () => 0)).toEqual({ term: "amor", genre: null });
  });
});

describe("pickOpenTrack", () => {
  const source = (results: Track[]): OpenTrackSource => ({ search: vi.fn(async () => results) });

  it("busca en la tienda del idioma y empieza la vista previa en 0", async () => {
    const src = source([song("a")]);
    const picked = await pickOpenTrack({ filters: filters({ genres: ["pop"], language: "pt" }), usedTrackIds: new Set(), source: src });
    expect(src.search).toHaveBeenCalledWith({ term: "pop", country: "BR" });
    expect(picked).toMatchObject({ startMs: 0, genre: "pop", audioUrl: "https://audio.example/a.m4a" });
  });

  it("descarta lo ya usado, lo que no tiene vista previa y lo que está fuera de los años", async () => {
    const picked = await pickOpenTrack({
      filters: filters({ yearFrom: 1990, yearTo: 1999 }),
      usedTrackIds: new Set(["used"]),
      source: source([
        song("used"),
        song("no-preview", { previewUrl: null }),
        song("too-new", { releaseYear: 2015 }),
        song("ok", { releaseYear: 1992 }),
      ]),
      random: () => 0,
    });
    expect(picked.track.id).toBe("ok");
  });

  it("falla con NO_TRACKS_FOUND si no hay candidatas", async () => {
    await expect(
      pickOpenTrack({ filters: filters({ keywords: "nada" }), usedTrackIds: new Set(), source: source([]) }),
    ).rejects.toMatchObject({ code: "NO_TRACKS_FOUND" });
  });
});
