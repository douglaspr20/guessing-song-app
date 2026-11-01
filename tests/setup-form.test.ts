import { describe, expect, it } from "vitest";
import { createGameSchema } from "@/lib/game/filters";
import { buildFilters, createGameBody, initialSetup, parseChosenArtists, peopleCount, setupBlocker, type SetupForm } from "@/lib/game/setup";
import { emptyTeams } from "@/lib/game/teams";

const form = (patch: Partial<SetupForm> = {}): SetupForm => ({ ...initialSetup(emptyTeams(2), "open"), ...patch });
const juanes = { id: "spotify:0UWZUmn7sybxMCqrw9tGa7", name: "Juanes" };

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

describe("no repetir canciones de otras partidas", () => {
  it("por defecto mira las últimas 5 y se envía lo elegido", () => {
    expect(createGameBody(form({ players: ["Ana"] }), [])).toMatchObject({ freshGames: 5 });
    expect(createGameSchema.parse(createGameBody(form({ players: ["Ana"], freshGames: 0 }), [])).freshGames).toBe(0);
    expect(() => createGameSchema.parse({ ...createGameBody(form({ players: ["Ana"] }), []), freshGames: 11 })).toThrow();
  });
});

describe("el anfitrión también juega", () => {
  it("si lo marca tiene que elegir uno de los nombres, y se manda ese", () => {
    expect(setupBlocker(form({ players: ["Ana", "Luis"], hostPlays: true }), [])).toBe("Elige con qué nombre juegas tú.");

    const f = form({ players: ["Ana", "Luis"], hostPlays: true, hostName: "Luis" });
    expect(setupBlocker(f, [])).toBeNull();
    expect(createGameBody(f, [])).toMatchObject({ hostPlaysAs: "Luis" });
    expect(createGameSchema.parse(createGameBody(f, [])).hostPlaysAs).toBe("Luis");
  });

  it("si el nombre elegido se borra de la lista, vuelve a pedirlo; sin marcar no se manda nada", () => {
    expect(setupBlocker(form({ players: ["Ana"], hostPlays: true, hostName: "Luis" }), [])).toBe(
      "Elige con qué nombre juegas tú.",
    );
    expect(createGameBody(form({ players: ["Ana"], hostName: "Ana" }), [])).not.toHaveProperty("hostPlaysAs");
  });
});

describe("lo que se envía", () => {
  it("cada fuente manda solo sus filtros", () => {
    const f = form({
      genres: ["pop"],
      keywords: "  bolero ",
      yearFrom: "1980",
      mode: "spotify",
      playlistIds: ["x"],
      artists: [juanes],
      popularity: "hits",
    });
    expect(buildFilters(f, ["x"])).toEqual({
      source: "search",
      genres: ["pop"],
      language: undefined,
      yearFrom: 1980,
      yearTo: undefined,
      keywords: "bolero",
      playlistIds: [],
      artists: [juanes],
      popularity: "hits",
    });
    // Con playlists no se mandan artistas ni popularidad (las canciones las eligió la persona).
    expect(buildFilters({ ...f, source: "playlists" }, ["x"])).toMatchObject({
      source: "playlists",
      genres: [],
      playlistIds: ["x"],
      artists: [],
      popularity: "mix",
    });
  });

  it("artistas y popularidad pasan la validación del servidor", () => {
    const shakira = { id: "itunes:889327", name: "Shakira" };
    const body = createGameBody(form({ players: ["Ana"], artists: [shakira, juanes], popularity: "gems" }), []);
    expect(createGameSchema.parse(body).filters).toMatchObject({ artists: [shakira, juanes], popularity: "gems" });
  });

  it("los artistas que llegan de /artists por la URL solo valen si traen id y nombre", () => {
    expect(parseChosenArtists(JSON.stringify([juanes, { name: "sin id" }, "texto"]))).toEqual([juanes]);
    expect(parseChosenArtists("no es json")).toEqual([]);
    expect(parseChosenArtists(JSON.stringify({ id: "x" }))).toEqual([]);
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
