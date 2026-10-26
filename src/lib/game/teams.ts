import { setup as esSetup } from "@/i18n/messages/es/setup";
/**
 * Partidas por equipos: paleta, límites y reparto de personas. Todo puro (sin base de datos)
 * para poder usarlo igual en el servidor, en el editor de /nueva y en los tests.
 */

export const GAME_FORMATS = ["solo", "teams"] as const;
export type GameFormat = (typeof GAME_FORMATS)[number];

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 8;
export const MIN_TEAM_SIZE = 1;
export const MAX_TEAM_SIZE = 10;
export const MAX_PEOPLE = 40;
export const DEFAULT_TEAMS = 2;
export const DEFAULT_TEAM_SIZE = 5;

/** Colores de equipo, en el orden en que se reparten. Ninguno es el tomate (reservado a la acción principal). */
export const TEAM_COLORS = [
  { key: "azafran", hex: "#e0a526" },
  { key: "cielo", hex: "#4f9fd0" },
  { key: "menta", hex: "#3fb68b" },
  { key: "ciruela", hex: "#8a4a8f" },
  { key: "teja", hex: "#b8683a" },
  { key: "pino", hex: "#2f6b4f" },
  { key: "lavanda", hex: "#8f86d6" },
  { key: "arena", hex: "#c2ad7a" },
] as const;

export type TeamColorKey = (typeof TEAM_COLORS)[number]["key"];
export const TEAM_COLOR_KEYS = TEAM_COLORS.map((c) => c.key) as [TeamColorKey, ...TeamColorKey[]];

export function teamColor(key: string | null | undefined) {
  return TEAM_COLORS.find((c) => c.key === key) ?? null;
}

/** Textos de equipos que dependen del idioma (la pantalla pasa los suyos; por defecto, en español). */
export type TeamTexts = Pick<typeof esSetup, "teamColors" | "defaultTeamName" | "teamsProblems">;

/** Nombre que nace con cada equipo, según su color: «Equipo Menta» / «Team Mint». */
export function defaultTeamName(colorKey: string, text: TeamTexts = esSetup) {
  return text.defaultTeamName(text.teamColors[colorKey as TeamColorKey] ?? colorKey);
}

/** Un equipo tal como lo maneja el editor y lo recibe la API. */
export interface TeamDraft {
  name: string;
  color: TeamColorKey;
  members: string[];
}

/** `count` equipos vacíos con los primeros colores de la paleta y su nombre por defecto. */
export function emptyTeams(count: number, text: TeamTexts = esSetup): TeamDraft[] {
  return TEAM_COLORS.slice(0, count).map((c) => ({ name: defaultTeamName(c.key, text), color: c.key, members: [] }));
}

/** ¿Caben `people` personas en `teamCount` equipos de como mucho `maxSize`? */
export function fits(people: number, teamCount: number, maxSize: number) {
  return people <= teamCount * maxSize;
}

/** Baraja (Fisher-Yates) sin tocar el original. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Reparte a las personas al azar entre los equipos, por turnos: los tamaños difieren como mucho en 1.
 * Conserva los nombres y colores de los equipos. Falla si no caben.
 */
export function distribute(
  names: readonly string[],
  teams: readonly TeamDraft[],
  maxSize: number,
  random: () => number = Math.random,
): TeamDraft[] {
  if (!fits(names.length, teams.length, maxSize)) {
    throw new RangeError(`No caben ${names.length} personas en ${teams.length} equipos de ${maxSize}`);
  }
  const out = teams.map((t) => ({ ...t, members: [] as string[] }));
  shuffle(names, random).forEach((name, i) => out[i % out.length].members.push(name));
  return out;
}

/** Índice del equipo con menos gente (el primero si hay empate), o -1 si todos están llenos. */
export function emptiestTeam(teams: readonly TeamDraft[], maxSize: number) {
  let best = -1;
  teams.forEach((t, i) => {
    if (t.members.length >= maxSize) return;
    if (best === -1 || t.members.length < teams[best].members.length) best = i;
  });
  return best;
}

/** Añade un nombre al equipo con menos gente. Devuelve el reparto nuevo, o null si no cabe. */
export function fillIn(teams: readonly TeamDraft[], name: string, maxSize: number): TeamDraft[] | null {
  const at = emptiestTeam(teams, maxSize);
  if (at === -1) return null;
  return teams.map((t, i) => (i === at ? { ...t, members: [...t.members, name] } : t));
}

/**
 * Cambia el número de equipos. Al bajar, los miembros de los que desaparecen pasan a los que quedan
 * (al más corto); al subir, los nuevos nacen vacíos con el siguiente color libre.
 */
export function resizeTeams(
  teams: readonly TeamDraft[],
  count: number,
  maxSize: number,
  text: TeamTexts = esSetup,
): TeamDraft[] {
  if (count >= teams.length) {
    const used = new Set(teams.map((t) => t.color));
    const free = TEAM_COLORS.filter((c) => !used.has(c.key));
    const added = free.slice(0, count - teams.length).map((c) => ({
      name: defaultTeamName(c.key, text),
      color: c.key,
      members: [] as string[],
    }));
    return [...teams, ...added];
  }
  let kept = teams.slice(0, count).map((t) => ({ ...t, members: [...t.members] }));
  for (const gone of teams.slice(count)) {
    for (const name of gone.members) {
      // Si ya no cabe en ningún lado, se queda en el más corto aunque pase del máximo: el editor lo avisa.
      kept = fillIn(kept, name, maxSize) ?? fillIn(kept, name, Infinity)!;
    }
  }
  return kept;
}

/** Mueve a una persona de equipo. Devuelve el reparto nuevo, o null si el destino está lleno. */
export function moveMember(
  teams: readonly TeamDraft[],
  from: number,
  name: string,
  to: number,
  maxSize: number,
): TeamDraft[] | null {
  if (from === to) return teams.map((t) => ({ ...t }));
  if (teams[to].members.length >= maxSize) return null;
  return teams.map((t, i) => {
    if (i === from) return { ...t, members: t.members.filter((m) => m !== name) };
    if (i === to) return { ...t, members: [...t.members, name] };
    return t;
  });
}

/** Equipos que pasan del máximo (para avisar en el editor). */
export function overfull(teams: readonly TeamDraft[], maxSize: number) {
  return teams.filter((t) => t.members.length > maxSize);
}

/** Todas las personas de todos los equipos, en orden. */
export function everyone(teams: readonly TeamDraft[]) {
  return teams.flatMap((t) => t.members);
}

/** Resumen corto de quiénes forman un equipo: «Ana, Luis, Marta +2». */
export function memberLine(members: readonly string[], shown = 3) {
  if (members.length <= shown) return members.join(", ");
  return `${members.slice(0, shown).join(", ")} +${members.length - shown}`;
}

/** Nombres repetidos (sin mirar mayúsculas), tal como los escribió la persona. */
export function repeated(names: readonly string[]) {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k)) dups.add(n);
    seen.add(k);
  }
  return [...dups];
}

/** Lo que impide grabar un reparto por equipos, o null si está bien (mismas reglas que el servidor). */
export function teamsProblem(teams: readonly TeamDraft[], maxSize: number, text: TeamTexts = esSetup): string | null {
  const p = text.teamsProblems;
  const people = everyone(teams);
  if (!people.length) return p.noPeople;
  const empty = teams.find((t) => !t.members.length);
  if (empty) return p.emptyTeam(empty.name || p.aTeam);
  const full = overfull(teams, maxSize)[0];
  if (full) return p.overfull(full.name, full.members.length, maxSize);
  if (teams.some((t) => !t.name.trim())) return p.unnamed;
  if (repeated(teams.map((t) => t.name.trim())).length) return p.sameTeamName;
  if (repeated(people).length) return p.repeatedPeople;
  if (people.length > MAX_PEOPLE) return p.tooMany(MAX_PEOPLE);
  return null;
}
