import { setup as esSetup } from "@/i18n/messages/es/setup";
import { DEFAULT_ANSWER_SECONDS, type GameMode } from "./filters";
import { DEFAULT_TEAM_SIZE, everyone, repeated, teamsProblem, type GameFormat, type TeamDraft } from "./teams";

export type SongSource = "search" | "playlists";

/** Todo lo que se elige en «Grabar partida nueva» (lo que luego se envía a POST /api/games). */
export interface SetupForm {
  /** Nombres tal cual se escriben (pueden estar vacíos o repetidos mientras se edita). */
  players: string[];
  /** "solo": todos contra todos. "teams": cada equipo puntúa junto. */
  format: GameFormat;
  teams: TeamDraft[];
  maxTeamSize: number;
  rounds: number;
  /** Quien juega desde el móvil: segundos para responder tras pulsar y quién queda fuera al fallar. */
  answerSeconds: number;
  lockout: "person" | "team";
  fragmentSeconds: number;
  /** "spotify": canción completa (necesita cuenta). "open": vistas previas de 30 s, sin cuenta. */
  mode: GameMode;
  source: SongSource;
  genres: string[];
  language: string;
  yearFrom: string;
  yearTo: string;
  keywords: string;
  playlistIds: string[];
  /** El anfitrión también juega desde su pantalla, con uno de los nombres (`hostName`). */
  hostPlays: boolean;
  hostName: string;
}

export function initialSetup(teams: TeamDraft[], mode: GameMode): SetupForm {
  return {
    players: ["", ""],
    format: "solo",
    teams,
    maxTeamSize: DEFAULT_TEAM_SIZE,
    rounds: 10,
    answerSeconds: DEFAULT_ANSWER_SECONDS,
    lockout: "person",
    fragmentSeconds: 60,
    mode,
    source: "search",
    genres: [],
    language: "",
    yearFrom: "",
    yearTo: "",
    keywords: "",
    playlistIds: [],
    hostPlays: false,
    hostName: "",
  };
}

/** Los nombres con los que puede jugar el anfitrión: los jugadores, o los miembros de los equipos. */
export const seatNames = (form: SetupForm) =>
  form.format === "teams" ? everyone(form.teams).map((n) => n.trim()).filter(Boolean) : playerNames(form);

/** El nombre con el que juega el anfitrión, si lo eligió y sigue estando en la partida. */
export function hostPlaysAs(form: SetupForm): string | null {
  if (!form.hostPlays) return null;
  const lower = form.hostName.trim().toLowerCase();
  return seatNames(form).find((n) => n.toLowerCase() === lower) ?? null;
}

/** Nombres escritos, sin huecos. */
export const playerNames = (form: SetupForm) => form.players.map((p) => p.trim()).filter(Boolean);

/** El modo abierto solo tiene búsqueda (no hay playlists sin cuenta). */
export const effectiveSource = (form: SetupForm): SongSource => (form.mode === "open" ? "search" : form.source);

/** Los filtros que se envían: cada fuente solo manda lo suyo. `usableIds` son las playlists que Spotify deja leer. */
export function buildFilters(form: SetupForm, usableIds: string[]) {
  const search = effectiveSource(form) === "search";
  return {
    source: effectiveSource(form),
    genres: search ? form.genres : [],
    language: search && form.language ? form.language : undefined,
    yearFrom: search && form.yearFrom ? Number(form.yearFrom) : undefined,
    yearTo: search && form.yearTo ? Number(form.yearTo) : undefined,
    keywords: search && form.keywords.trim() ? form.keywords.trim() : undefined,
    playlistIds: search ? [] : usableIds,
  };
}

/** Personas que juegan: en equipos, la suma de sus miembros. */
export const peopleCount = (form: SetupForm) =>
  form.format === "teams" ? everyone(form.teams).length : playerNames(form).length;

/** Lo que impide grabar la partida (en el idioma de `text`), o null si se puede. Mismas reglas que el servidor. */
export function setupBlocker(form: SetupForm, usableIds: string[], text: typeof esSetup = esSetup): string | null {
  const names = playerNames(form);
  const who =
    form.format === "teams"
      ? teamsProblem(form.teams, form.maxTeamSize, text)
      : names.length === 0
        ? text.needOnePlayer
        : repeated(names).length
          ? text.repeatedNames
          : null;
  if (who) return who;
  if (form.hostPlays && !hostPlaysAs(form)) return text.hostPickName;
  if (effectiveSource(form) === "playlists" && usableIds.length === 0) return text.needPlaylist;
  if (form.yearFrom && form.yearTo && Number(form.yearFrom) > Number(form.yearTo)) return text.yearsInverted;
  return null;
}

/** El cuerpo de POST /api/games. */
export function createGameBody(form: SetupForm, usableIds: string[]) {
  return {
    mode: form.mode,
    format: form.format,
    ...(form.format === "teams"
      ? { teams: form.teams.map((t) => ({ ...t, name: t.name.trim() })), maxTeamSize: form.maxTeamSize }
      : { players: playerNames(form) }),
    rounds: form.rounds,
    fragmentSeconds: form.fragmentSeconds,
    answerSeconds: form.answerSeconds,
    lockout: form.lockout,
    filters: buildFilters(form, usableIds),
    ...(hostPlaysAs(form) ? { hostPlaysAs: hostPlaysAs(form)! } : {}),
  };
}
