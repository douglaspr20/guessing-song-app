import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { pickWithFallback } from "@/lib/game/fallback";
import { gameFiltersSchema, type GameFilters } from "@/lib/game/filters";

const filters = (f: Record<string, unknown> = {}) => gameFiltersSchema.parse(f);
const none = () => new AppError("NO_TRACKS_FOUND", 404);

describe("respaldo: aflojar los filtros antes que dejar una ronda sin canción", () => {
  it("con los filtros tal cual no afloja nada", async () => {
    const pick = vi.fn(async () => "ok");
    expect(await pickWithFallback(filters({ yearFrom: 1980, yearTo: 1989 }), pick)).toEqual({ picked: "ok", relaxed: [] });
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it("afloja en orden (popularidad, años, palabra clave, artistas, géneros, idioma) y para en cuanto sale algo", async () => {
    const seen: GameFilters[] = [];
    const pick = vi.fn(async (f: GameFilters) => {
      seen.push(f);
      // Sale algo solo cuando ya no hay artistas.
      if (f.artists.length) throw none();
      return "ok";
    });
    const result = await pickWithFallback(
      filters({ popularity: "gems", yearFrom: 1980, yearTo: 1989, keywords: "amor", artists: [{ id: "itunes:1", name: "Nadie" }], genres: ["salsa"], language: "es" }),
      pick,
    );

    expect(result.relaxed).toEqual(["popularity", "years", "keywords", "artists"]);
    expect(seen.at(-1)).toMatchObject({ popularity: "mix", yearFrom: undefined, keywords: undefined, artists: [], genres: ["salsa"], language: "es" });
  });

  it("se salta los pasos que no aplican (sin años no hay nada que aflojar ahí)", async () => {
    const pick = vi.fn(async (f: GameFilters) => {
      if (f.genres.length) throw none();
      return "ok";
    });
    expect((await pickWithFallback(filters({ genres: ["salsa"] }), pick)).relaxed).toEqual(["genres"]);
  });

  it("otros errores (iTunes limitando) no se tapan aflojando filtros", async () => {
    const pick = vi.fn(async () => {
      throw new AppError("ITUNES_RATE_LIMITED", 429);
    });
    await expect(pickWithFallback(filters({ yearFrom: 1980 }), pick)).rejects.toMatchObject({ code: "ITUNES_RATE_LIMITED" });
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it("si ni sin idioma sale nada, sigue el error de siempre", async () => {
    const pick = vi.fn(async () => {
      throw none();
    });
    await expect(pickWithFallback(filters({ language: "es" }), pick)).rejects.toMatchObject({ code: "NO_TRACKS_FOUND" });
  });

  it("las playlists no se aflojan: las eligió la persona", async () => {
    const pick = vi.fn(async () => {
      throw none();
    });
    await expect(pickWithFallback(filters({ source: "playlists", playlistIds: ["x"], yearFrom: 1990 }), pick)).rejects.toMatchObject({
      code: "NO_TRACKS_FOUND",
    });
    expect(pick).toHaveBeenCalledTimes(1);
  });
});
