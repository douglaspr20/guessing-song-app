import { describe, expect, it, vi } from "vitest";
import { runCleanup } from "@/lib/access/admin";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cachedSearch, ITUNES_CACHE } from "@/lib/itunes/cache";
import { FAKE_TRACKS } from "@/lib/itunes/fake";

const HOUR = 60 * 60_000;
const at = (ms: number) => new Date(Date.UTC(2026, 9, 28) + ms);
const search = { term: "  Salsa   Brava ", country: "US" };
const songs = FAKE_TRACKS.slice(0, 3);
const rateLimited = () => Promise.reject(new AppError("ITUNES_RATE_LIMITED", 429));

describe("caché de búsquedas de iTunes", () => {
  it("la misma búsqueda (con otras mayúsculas o espacios) solo llama a iTunes una vez mientras está fresca", async () => {
    const fetchSongs = vi.fn().mockResolvedValue(songs);
    expect(await cachedSearch(search, fetchSongs, at(0))).toEqual(songs);
    expect(await cachedSearch({ term: "salsa brava", country: "US" }, fetchSongs, at(HOUR))).toEqual(songs);
    expect(fetchSongs).toHaveBeenCalledTimes(1);
    expect(fetchSongs).toHaveBeenCalledWith({ term: "salsa brava", country: "US" });

    // Otra tienda es otra búsqueda.
    await cachedSearch({ ...search, country: "MX" }, fetchSongs, at(HOUR));
    expect(fetchSongs).toHaveBeenCalledTimes(2);
  });

  it("pasado el tiempo de frescura vuelve a preguntar y renueva lo guardado", async () => {
    const fetchSongs = vi.fn().mockResolvedValueOnce(songs).mockResolvedValueOnce(FAKE_TRACKS.slice(3, 5));
    await cachedSearch(search, fetchSongs, at(0));
    expect(await cachedSearch(search, fetchSongs, at(ITUNES_CACHE.freshMs + 1))).toEqual(FAKE_TRACKS.slice(3, 5));
    expect(fetchSongs).toHaveBeenCalledTimes(2);
  });

  it("si iTunes limita, se juega con lo último guardado aunque sea viejo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await cachedSearch(search, async () => songs, at(0));
    expect(await cachedSearch(search, rateLimited, at(10 * 24 * HOUR))).toEqual(songs);
  });

  it("sin nada guardado, el error de iTunes llega tal cual y no se guarda nada", async () => {
    await expect(cachedSearch(search, rateLimited, at(0))).rejects.toMatchObject({ code: "ITUNES_RATE_LIMITED" });
    expect(await db.itunesSearch.count()).toBe(0);
  });

  it("una búsqueda vacía se recuerda menos tiempo", async () => {
    const fetchSongs = vi.fn().mockResolvedValue([]);
    await cachedSearch(search, fetchSongs, at(0));
    await cachedSearch(search, fetchSongs, at(ITUNES_CACHE.emptyFreshMs - 1));
    expect(fetchSongs).toHaveBeenCalledTimes(1);
    await cachedSearch(search, fetchSongs, at(ITUNES_CACHE.emptyFreshMs + 1));
    expect(fetchSongs).toHaveBeenCalledTimes(2);
  });

  it("la limpieza diaria borra solo lo que lleva más de 30 días sin renovarse", async () => {
    await cachedSearch({ term: "vieja", country: "US" }, async () => songs, at(0));
    await cachedSearch({ term: "nueva", country: "US" }, async () => songs, at((ITUNES_CACHE.keepDays - 1) * 24 * HOUR));
    const result = await runCleanup(at((ITUNES_CACHE.keepDays + 1) * 24 * HOUR));
    expect(result.itunesSearches).toBe(1);
    expect((await db.itunesSearch.findMany()).map((s) => s.term)).toEqual(["nueva"]);
  });
});
