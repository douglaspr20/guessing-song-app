import { z } from "zod";
import { LANGUAGES } from "@/lib/spotify/catalog";
import { GAME_FORMATS, MAX_PEOPLE, MAX_TEAM_SIZE, MAX_TEAMS, MIN_TEAMS, TEAM_COLOR_KEYS } from "./teams";

const languageIds = LANGUAGES.map((l) => l.id) as [string, ...string[]];
const currentYear = new Date().getFullYear();
const year = z.number().int().min(1900).max(currentYear + 1);

export const gameFiltersSchema = z
  .object({
    /** De dónde salen las canciones: búsqueda con filtros o playlists propias. */
    source: z.enum(["search", "playlists"]).default("search"),
    genres: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    /** Idioma aproximado (se traduce a un mercado). */
    language: z.enum(languageIds).optional(),
    /** Mercado explícito (código ISO de país). Tiene prioridad sobre `language`. */
    market: z
      .string()
      .regex(/^[A-Z]{2}$/, "Código de país ISO de 2 letras")
      .optional(),
    yearFrom: year.optional(),
    yearTo: year.optional(),
    /** Texto libre extra para la búsqueda (p. ej. "en español", un artista...). */
    keywords: z.string().trim().max(100).optional(),
    /** Popularidad mínima (0-100), solo si Spotify la devuelve. */
    minPopularity: z.number().int().min(0).max(100).optional(),
    playlistIds: z.array(z.string().min(1)).max(20).default([]),
  })
  .refine((f) => f.source !== "playlists" || f.playlistIds.length > 0, {
    message: "Elige al menos una playlist",
    path: ["playlistIds"],
  })
  .refine((f) => !f.yearFrom || !f.yearTo || f.yearFrom <= f.yearTo, {
    message: "yearFrom debe ser menor o igual que yearTo",
    path: ["yearFrom"],
  });

export type GameFilters = z.infer<typeof gameFiltersSchema>;

export const MIN_FRAGMENT_SECONDS = 60;
export const MAX_FRAGMENT_SECONDS = 180;
/** Las vistas previas de iTunes duran siempre 30 s. */
export const OPEN_FRAGMENT_SECONDS = 30;

export const gameModeSchema = z.enum(["spotify", "open"]);

/** En modo abierto el fragmento es la vista previa entera y solo hay búsqueda (no hay playlists sin cuenta). */
function applyOpenModeDefaults(input: unknown) {
  if (!input || typeof input !== "object" || (input as { mode?: unknown }).mode !== "open") return input;
  const data = input as { filters?: Record<string, unknown> };
  return {
    ...data,
    fragmentSeconds: OPEN_FRAGMENT_SECONDS,
    filters: { ...(data.filters ?? {}), source: "search", playlistIds: [] },
  };
}

const personName = z.string().trim().min(1).max(30);

const teamSchema = z.object({
  name: personName,
  color: z.enum(TEAM_COLOR_KEYS),
  members: z.array(personName).max(MAX_TEAM_SIZE),
});

export type TeamInput = z.input<typeof teamSchema>;

const distinct = (names: string[]) => new Set(names.map((n) => n.toLowerCase())).size === names.length;

const gameSettingsSchema = z.object({
  mode: gameModeSchema.default("spotify"),
  /** Todos contra todos (cada jugador puntúa solo) o por equipos. */
  format: z.enum(GAME_FORMATS).default("solo"),
  /** Jugadores sueltos (formato "solo"). */
  players: z.array(personName).max(MAX_PEOPLE).default([]),
  /** Equipos con sus miembros (formato "teams"). */
  teams: z.array(teamSchema).max(MAX_TEAMS).default([]),
  /** Máximo de miembros por equipo (formato "teams"). */
  maxTeamSize: z.number().int().min(1).max(MAX_TEAM_SIZE).optional(),
  rounds: z.number().int().min(1).max(50),
  fragmentSeconds: z.number().int().min(OPEN_FRAGMENT_SECONDS).max(MAX_FRAGMENT_SECONDS).default(MIN_FRAGMENT_SECONDS),
  filters: gameFiltersSchema.default({ source: "search", genres: [], playlistIds: [] }),
});

export const MAX_SOLO_PLAYERS = 20;

type Settings = z.infer<typeof gameSettingsSchema>;

/** Las reglas de quién juega: jugadores sueltos o equipos. */
function checkWhoPlays(g: Settings, ctx: z.RefinementCtx) {
  const fail = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });

  if (g.format === "solo") {
    if (g.players.length < 1) fail("Escribe el nombre de al menos un jugador", ["players"]);
    if (g.players.length > MAX_SOLO_PLAYERS) fail(`Como mucho ${MAX_SOLO_PLAYERS} jugadores`, ["players"]);
    if (!distinct(g.players)) fail("Los nombres de los jugadores deben ser distintos", ["players"]);
    return;
  }

  const { teams, maxTeamSize } = g;
  if (teams.length < MIN_TEAMS) fail(`Hacen falta al menos ${MIN_TEAMS} equipos`, ["teams"]);
  if (!maxTeamSize) fail("Indica el máximo de miembros por equipo", ["maxTeamSize"]);
  if (!distinct(teams.map((t) => t.name))) fail("Los nombres de los equipos deben ser distintos", ["teams"]);
  if (new Set(teams.map((t) => t.color)).size !== teams.length) fail("Cada equipo necesita un color distinto", ["teams"]);
  teams.forEach((t, i) => {
    if (!t.members.length) fail(`${t.name} no tiene a nadie`, ["teams", i, "members"]);
    if (maxTeamSize && t.members.length > maxTeamSize) {
      fail(`${t.name} tiene ${t.members.length} y el máximo es ${maxTeamSize}`, ["teams", i, "members"]);
    }
  });
  const everyone = teams.flatMap((t) => t.members);
  if (everyone.length > MAX_PEOPLE) fail(`Como mucho ${MAX_PEOPLE} personas`, ["teams"]);
  if (!distinct(everyone)) fail("Los nombres de las personas deben ser distintos", ["teams"]);
}

export const createGameSchema = z.preprocess(
  applyOpenModeDefaults,
  gameSettingsSchema
    .refine((g) => g.mode === "open" || g.fragmentSeconds >= MIN_FRAGMENT_SECONDS, {
      message: `Con Spotify el fragmento dura al menos ${MIN_FRAGMENT_SECONDS} s`,
      path: ["fragmentSeconds"],
    })
    .superRefine(checkWhoPlays),
);

export type CreateGameInput = z.input<typeof gameSettingsSchema>;
export type GameMode = z.infer<typeof gameModeSchema>;
