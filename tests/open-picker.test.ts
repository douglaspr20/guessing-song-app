import { describe, expect, it, vi } from "vitest";
import { gameFiltersSchema } from "@/lib/game/filters";
import { buildOpenTerm, matchesStoreGenre, pickOpenTrack, type OpenTrackSource } from "@/lib/game/open-picker";
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
    expect(buildOpenTerm(filters({ genres: ["salsa"], keywords: "lavoe" }))).toEqual({ term: "salsa lavoe", genre: "salsa", artist: null });
  });
  it("usa las palabras clave si no hay género", () => {
    expect(buildOpenTerm(filters({ keywords: "soda stereo" }))).toEqual({ term: "soda stereo", genre: null, artist: null });
  });
  it("sin filtros usa una palabra común del idioma", () => {
    expect(buildOpenTerm(filters({ language: "es" }), () => 0)).toEqual({ term: "amor", genre: null, artist: null });
  });
  it("con artistas elegidos busca solo por el nombre de uno de ellos (los géneros no cuentan)", () => {
    const shakira = { id: "itunes:1", name: "Shakira" };
    const juanes = { id: "itunes:2", name: "Juanes" };
    expect(buildOpenTerm(filters({ genres: ["pop"], artists: [shakira, juanes], keywords: "x" }), () => 0.9)).toEqual({
      term: "Juanes",
      genre: null,
      artist: juanes,
      attribute: "artistTerm",
    });
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

  it("en un género tropical descarta lo que la tienda clasifica como otra cosa (el género solo estaba en el título)", async () => {
    const picked = await pickOpenTrack({
      filters: filters({ genres: ["salsa"] }),
      usedTrackIds: new Set(),
      source: source([
        song("rap", { name: "Salsa Tártara", storeGenre: "Hip-Hop/Rap" }),
        song("urbano", { storeGenre: "Urbano latino" }),
        song("lavoe", { storeGenre: "Salsa y tropical" }),
      ]),
      random: () => 0,
    });
    expect(picked.track.id).toBe("lavoe");
    expect(picked.via).toBe("itunes: salsa (US) mix");
  });

  it("acepta los nombres de la tienda en cada país y lo que no trae género", () => {
    const ok = (storeGenre: string | null) => matchesStoreGenre(song("x", { storeGenre }), "vallenato");
    expect(["Salsa y tropical", "Música tropical", "Latin", "Música latina", null].map(ok)).toEqual([true, true, true, true, true]);
    expect(["Pop", "Hip-Hop/Rap", "Urbano latino", "Pop Latino"].map(ok)).toEqual([false, false, false, false]);
    // Los géneros que no son tropicales no se filtran.
    expect(matchesStoreGenre(song("x", { storeGenre: "Hip-Hop/Rap" }), "pop")).toBe(true);
  });

  it("falla con NO_TRACKS_FOUND si no hay candidatas", async () => {
    await expect(
      pickOpenTrack({ filters: filters({ keywords: "nada" }), usedTrackIds: new Set(), source: source([]) }),
    ).rejects.toMatchObject({ code: "NO_TRACKS_FOUND" });
  });

  it("con un artista busca por su nombre y solo acepta canciones suyas (ni parecidos ni colaboraciones ajenas)", async () => {
    const src = source([
      song("parecida", { artists: ["Shakira Jasmine"] }),
      song("ajena", { artists: ["Carlos Vives & Shakira"] }),
      song("suya", { artists: ["Shakira"] }),
    ]);
    // Elegida desde el directorio de Spotify: su id no sirve en iTunes, se compara el nombre exacto.
    const fromSpotify = { id: "spotify:abc", name: "Shakira" };
    const picked = await pickOpenTrack({ filters: filters({ artists: [fromSpotify] }), usedTrackIds: new Set(), source: src, random: () => 0 });
    expect(src.search).toHaveBeenCalledWith({ term: "Shakira", country: "US", attribute: "artistTerm" });
    expect(picked.track.id).toBe("suya");
    expect(picked.genre).toBeNull();
  });

  it("con el id de la tienda distingue a dos artistas que se llaman igual", async () => {
    const src = source([
      song("otra-a", { artists: ["A"], artistIds: ["111"] }),
      song("la-buena", { artists: ["A"], artistIds: ["222"] }),
    ]);
    const picked = await pickOpenTrack({
      filters: filters({ artists: [{ id: "itunes:222", name: "A" }] }),
      usedTrackIds: new Set(),
      source: src,
      random: () => 0,
    });
    expect(picked.track.id).toBe("la-buena");
  });

  describe("popularidad por posición en los resultados", () => {
    // 100 resultados en el orden de la tienda (el 0 es el más relevante).
    const ranked = Array.from({ length: 100 }, (_, i) => song(`r${i}`));
    const pick = async (popularity: "hits" | "mix" | "gems", r: number) =>
      (await pickOpenTrack({ filters: filters({ genres: ["pop"], popularity }), usedTrackIds: new Set(), source: source(ranked), random: () => r }))
        .track.id;

    it("«Solo éxitos» elige entre los 40 primeros", async () => {
      expect(await pick("hits", 0)).toBe("r0");
      expect(await pick("hits", 0.999)).toBe("r39");
    });

    it("«Joyas escondidas» elige a partir del puesto 60", async () => {
      expect(await pick("gems", 0)).toBe("r60");
      expect(await pick("gems", 0.999)).toBe("r99");
    });

    it("«Mezcla» elige entre todos", async () => {
      expect(await pick("mix", 0.999)).toBe("r99");
      expect(await pick("mix", 0)).toBe("r0");
    });
  });
});
