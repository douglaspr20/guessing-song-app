import { describe, expect, it } from "vitest";
import { artistsFromTracks, interleave, isSingleArtist, paginate, smallCover } from "@/lib/artists/aggregate";
import type { Track } from "@/lib/spotify/types";

const song = (artist: string, i = 0, patch: Partial<Track> = {}): Track => ({
  id: `${artist}-${i}`,
  uri: `x:${artist}-${i}`,
  name: `Song ${i}`,
  artists: [artist],
  artistIds: [],
  durationMs: 30_000,
  albumImage: `https://is1.mzstatic.com/${artist}/600x600bb.jpg`,
  popularity: null,
  isPlayable: true,
  ...patch,
});

describe("directorio de artistas a partir de canciones", () => {
  it("en orden de aparición (los más conocidos primero), sin repetir y con la portada a 300", () => {
    const list = artistsFromTracks([{ genre: null, tracks: [song("Shakira"), song("Juanes"), song("shakira", 2)] }]);
    expect(list).toEqual([
      { id: "itunes:name:shakira", name: "Shakira", image: "https://is1.mzstatic.com/Shakira/300x300bb.jpg" },
      { id: "itunes:name:juanes", name: "Juanes", image: "https://is1.mzstatic.com/Juanes/300x300bb.jpg" },
    ]);
  });

  it("intercala los géneros para que ninguno tape a otro", () => {
    const list = artistsFromTracks([
      { genre: "pop", tracks: [song("A1"), song("A2"), song("A3")] },
      { genre: "rock", tracks: [song("B1")] },
    ]);
    expect(list.map((a) => a.name)).toEqual(["A1", "B1", "A2", "A3"]);
  });

  it("quita colaboraciones puntuales pero deja los dúos", () => {
    expect(["Shakira feat. Maluma", "A ft. B", "A, B, C & D", "Wisin & Yandel", "Ha*Ash"].map(isSingleArtist)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it("una colaboración suelta («A & B» con una canción) no entra; un dúo con varias canciones sí", () => {
    const list = artistsFromTracks([
      {
        genre: null,
        tracks: [song("Bad Bunny & Bomba Estéreo"), song("Wisin & Yandel", 1), song("Wisin & Yandel", 2), song("Carlos Vives y Shakira")],
      },
    ]);
    expect(list.map((a) => a.name)).toEqual(["Wisin & Yandel"]);
  });

  it("en los géneros tropicales deja fuera lo que la tienda no clasifica como tropical", () => {
    const list = artistsFromTracks([
      { genre: "salsa", tracks: [song("Rapero", 0, { storeGenre: "Hip-Hop/Rap" }), song("Marc Anthony", 0, { storeGenre: "Salsa y tropical" })] },
    ]);
    expect(list.map((a) => a.name)).toEqual(["Marc Anthony"]);
  });

  it("intercala listas sin repetir: el mismo id una vez; el mismo nombre de otra fuente (relleno de iTunes), también", () => {
    const list = interleave([
      [
        { id: "spotify:1", name: "A", image: null },
        { id: "spotify:2", name: "B", image: null },
      ],
      [
        { id: "itunes:9", name: "a", image: "x" },
        { id: "spotify:1", name: "A", image: null },
        { id: "itunes:3", name: "C", image: null },
      ],
    ]);
    expect(list.map((a) => a.id)).toEqual(["spotify:1", "spotify:2", "itunes:3"]);
  });

  it("dos artistas distintos con el mismo nombre en la misma fuente se quedan los dos (sus ids son distintos)", () => {
    const list = interleave([[{ id: "spotify:1", name: "A", image: null }], [{ id: "spotify:2", name: "A", image: null }]]);
    expect(list.map((a) => a.id)).toEqual(["spotify:1", "spotify:2"]);
  });

  it("con iTunes el id es el del artista en la tienda (y sin él, en búsquedas viejas de la caché, su nombre)", () => {
    const list = artistsFromTracks([
      { genre: null, tracks: [song("Shakira", 0, { artistIds: ["889327"] }), song("Juanes", 1)] },
    ]);
    expect(list.map((a) => a.id)).toEqual(["itunes:889327", "itunes:name:juanes"]);
  });

  it("pagina de 24 en 24 y sabe si hay más", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(paginate(items, 1)).toMatchObject({ items: items.slice(0, 24), page: 1, pages: 3, hasMore: true });
    expect(paginate(items, 3)).toMatchObject({ items: [48, 49], page: 3, hasMore: false });
    // Una página que no existe se queda en la última.
    expect(paginate(items, 9).page).toBe(3);
  });

  it("la portada a 300 sirve llegue al tamaño que llegue", () => {
    expect(smallCover("https://x/100x100bb.jpg")).toBe("https://x/300x300bb.jpg");
    expect(smallCover(null)).toBeNull();
  });
});
