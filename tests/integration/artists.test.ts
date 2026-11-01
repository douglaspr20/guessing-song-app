import { describe, expect, it, vi } from "vitest";
import { listArtists, type ArtistSources } from "@/lib/artists/directory";
import type { OpenSearch } from "@/lib/game/open-picker";
import type { Track } from "@/lib/spotify/types";

const song = (artist: string, i: number): Track => ({
  id: `${artist}-${i}`,
  uri: `x:${artist}-${i}`,
  name: `Song ${i}`,
  artists: [artist],
  artistIds: [],
  durationMs: 30_000,
  albumImage: `https://cover/${artist}/600x600bb.jpg`,
  popularity: null,
  isPlayable: true,
});

/** iTunes falso: por género, 30 artistas con su nombre; por artista, solo los que contienen el nombre. */
function fakeItunes() {
  const search = vi.fn(async ({ term, attribute }: OpenSearch) =>
    attribute === "artistTerm"
      ? [song(`${term} Uno`, 0), song(`${term} Dos`, 1)]
      : Array.from({ length: 30 }, (_, i) => song(`${term}-${i}`, i)),
  );
  return { search };
}

describe("directorio de artistas (iTunes)", () => {
  it("lista los artistas de los géneros intercalados, paginados de 24 en 24", async () => {
    const itunes = fakeItunes();
    const sources: ArtistSources = { itunes, spotify: vi.fn() };

    const first = await listArtists({ source: "itunes", genres: ["pop", "rock"], language: "es-latam", page: 1 }, sources);

    expect(itunes.search).toHaveBeenCalledWith({ term: "pop", country: "MX" });
    expect(first.artists.slice(0, 3).map((a) => a.name)).toEqual(["pop-0", "rock-0", "pop-1"]);
    expect(first).toMatchObject({ page: 1, pages: 3, hasMore: true });
    expect(first.artists[0].image).toBe("https://cover/pop-0/300x300bb.jpg");
  });

  it("buscando un artista no salen sus colaboraciones (sí el dúo si se busca entero)", async () => {
    const tracks = [
      song("Shakira", 0),
      song("Carlos Vives & Shakira", 1),
      song("Carlos Vives & Shakira", 2),
      song("YK Osiris", 3),
      song("Black Eyed Peas, Shakira & David Guetta", 6),
      song("Black Eyed Peas, Shakira & David Guetta", 7),
      song("Wisin & Yandel", 4),
      song("Wisin & Yandel", 5),
    ];
    const itunes = { search: vi.fn(async () => tracks) };
    const shakira = await listArtists({ source: "itunes", genres: [], q: "shakira", page: 1 }, { itunes, spotify: vi.fn() });
    // Ni sus colaboraciones ni quien solo canta con ella: solo artistas con ese nombre.
    expect(shakira.artists.map((a) => a.name)).toEqual(["Shakira"]);
    const duo = await listArtists({ source: "itunes", genres: [], q: "Wisin & Yandel", page: 1 }, { itunes, spotify: vi.fn() });
    expect(duo.artists.map((a) => a.name)).toContain("Wisin & Yandel");
  });

  it("con época solo quedan artistas con canciones de esos años", async () => {
    const tracks = [
      { ...song("Ochentero", 0), releaseYear: 1985 },
      { ...song("Actual", 1), releaseYear: 2021 },
      { ...song("Sin año", 2), releaseYear: null },
    ];
    const itunes = { search: vi.fn(async () => tracks) };
    const res = await listArtists(
      { source: "itunes", genres: ["pop"], yearFrom: 1980, yearTo: 1989, page: 1 },
      { itunes, spotify: vi.fn() },
    );
    expect(res.artists.map((a) => a.name)).toEqual(["Ochentero"]);
  });

  it("el buscador busca por nombre de artista", async () => {
    const itunes = fakeItunes();
    const res = await listArtists({ source: "itunes", genres: ["pop"], q: "Shaki", page: 1 }, { itunes, spotify: vi.fn() });
    expect(itunes.search).toHaveBeenCalledWith({ term: "Shaki", country: "US", attribute: "artistTerm" });
    expect(res.artists.map((a) => a.name)).toEqual(["Shaki Uno", "Shaki Dos"]);
  });
});

describe("directorio de artistas (Spotify)", () => {
  const spotifyArtists = (prefix: string, offset: number, limit: number) =>
    Array.from({ length: limit }, (_, i) => ({
      id: `spotify:${prefix}${offset + i}`,
      name: `${prefix}${offset + i}`,
      image: `https://photo/${prefix}${offset + i}`,
    }));

  it("usa las fotos de Spotify y completa con iTunes un género que Spotify no conoce", async () => {
    const itunes = fakeItunes();
    const spotify = vi.fn(async (_u: string, { q, offset, limit }: { q: string; offset: number; limit: number }) => ({
      items: q.includes("salsa") ? [] : spotifyArtists("S", offset, limit),
    }));

    const res = await listArtists({ source: "spotify", userId: "u1", genres: ["pop", "salsa"], page: 1 }, { itunes, spotify });

    expect(res.artists[0]).toEqual({ id: "spotify:S0", name: "S0", image: "https://photo/S0" });
    expect(res.artists[1].name).toBe("salsa-0"); // de iTunes
    expect(res.artists).toHaveLength(24);
    expect(res.hasMore).toBe(true);
  });

  it("sin géneros ni buscador pide una categoría amplia (no una letra suelta, que trae artistas llamados «A»)", async () => {
    const spotify = vi.fn(async (_u: string, { offset, limit }: { q: string; offset: number; limit: number }) => ({ items: spotifyArtists("L", offset, limit) }));
    await listArtists({ source: "spotify", userId: "u1", genres: [], language: "es-latam", page: 1 }, { itunes: fakeItunes(), spotify });
    expect(spotify.mock.calls[0][1].q).toBe('genre:"latin"');
    spotify.mockClear();
    await listArtists({ source: "spotify", userId: "u1", genres: [], language: "en", page: 1 }, { itunes: fakeItunes(), spotify });
    expect(spotify.mock.calls[0][1].q).toBe('genre:"pop"');
  });

  it("la época no se manda a Spotify (su `year:` no filtra artistas: con él no devuelve ninguno)", async () => {
    const spotify = vi.fn(async (_u: string, { offset, limit }: { q: string; offset: number; limit: number }) => ({ items: spotifyArtists("Y", offset, limit) }));
    await listArtists(
      { source: "spotify", userId: "u1", genres: ["pop"], yearFrom: 1990, yearTo: 1999, page: 1 },
      { itunes: fakeItunes(), spotify },
    );
    expect(spotify.mock.calls[0][1].q).toBe('genre:"pop"');
  });

  it("con buscador pide a Spotify de 10 en 10 hasta llenar la página", async () => {
    const spotify = vi.fn(async (_u: string, { offset, limit }: { offset: number; limit: number }) => ({ items: spotifyArtists("A", offset, limit) }));
    const res = await listArtists({ source: "spotify", userId: "u1", genres: [], q: "shakira", page: 2 }, { itunes: fakeItunes(), spotify });
    expect(spotify.mock.calls.map(([, p]) => p.offset)).toEqual([24, 34, 44]);
    expect(res.artists).toHaveLength(24);
    expect(res.artists[0].name).toBe("A24");
  });
});
