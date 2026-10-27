import { describe, expect, it } from "vitest";
import { createGameSchema } from "@/lib/game/filters";
import { buildFilters, createGameBody, initialSetup, peopleCount, setupBlocker, type SetupForm } from "@/lib/game/setup";
import { emptyTeams } from "@/lib/game/teams";

const form = (patch: Partial<SetupForm> = {}): SetupForm => ({ ...initialSetup(emptyTeams(2), "open"), ...patch });

describe("lo que impide grabar la partida", () => {
  it("pide al menos un jugador y nombres distintos", () => {
    expect(setupBlocker(form(), [])).toBe("Escribe el nombre de al menos un jugador.");
    expect(setupBlocker(form({ players: ["Ana", "ana"] }), [])).toBe("Hay nombres repetidos.");
    expect(setupBlocker(form({ players: ["Ana", " "] }), [])).toBeNull();
  });

  it("por equipos aplica las reglas de los equipos", () => {
    expect(setupBlocker(form({ format: "teams" }), [])).toBe("Añade a las personas que juegan.");
  });

  it("años al revés y playlists sin elegir (solo en Spotify)", () => {
    expect(setupBlocker(form({ players: ["Ana"], yearFrom: "2000", yearTo: "1990" }), [])).toBe(
      "El año «desde» es mayor que el año «hasta».",
    );
    expect(setupBlocker(form({ players: ["Ana"], mode: "spotify", source: "playlists" }), [])).toBe(
      "Elige al menos una playlist.",
    );
    // En modo abierto no hay playlists: la fuente es siempre la búsqueda.
    expect(setupBlocker(form({ players: ["Ana"], source: "playlists" }), [])).toBeNull();
  });
});

describe("lo que se envía", () => {
  it("cada fuente manda solo sus filtros", () => {
    const f = form({ genres: ["pop"], keywords: "  bolero ", yearFrom: "1980", mode: "spotify", playlistIds: ["x"] });
    expect(buildFilters(f, ["x"])).toEqual({
      source: "search",
      genres: ["pop"],
      language: undefined,
      yearFrom: 1980,
      yearTo: undefined,
      keywords: "bolero",
      playlistIds: [],
    });
    expect(buildFilters({ ...f, source: "playlists" }, ["x"])).toMatchObject({ source: "playlists", genres: [], playlistIds: ["x"] });
  });

  it("el cuerpo de la partida pasa la validación del servidor", () => {
    const solo = createGameBody(form({ players: ["Ana", "", "Luis"] }), []);
    expect(solo).toMatchObject({ players: ["Ana", "Luis"], format: "solo" });
    expect(() => createGameSchema.parse(solo)).not.toThrow();

    const teams = form({ format: "teams", teams: emptyTeams(2).map((t, i) => ({ ...t, members: [`P${i}`] })) });
    expect(peopleCount(teams)).toBe(2);
    expect(() => createGameSchema.parse(createGameBody(teams, []))).not.toThrow();
  });
});
