import { TEAM_COLORS } from "./teams";

interface Scored {
  score: number;
}

/**
 * Puesto de cada uno según sus puntos, con empates compartidos («1, 1, 3»).
 * `players` ya viene ordenado de más a menos puntos; `among` es la lista con la que se compara (por defecto, la misma).
 */
export function placeOf(player: Scored, among: readonly Scored[]): number {
  return among.findIndex((q) => q.score === player.score) + 1;
}

/** Cada jugador con su puesto (`place`), para el podio y el marcador. */
export function withPlaces<T extends Scored>(players: readonly T[]): (T & { place: number })[] {
  return players.map((p) => ({ ...p, place: placeOf(p, players) }));
}

export type WinnerSummary =
  | { kind: "none" }
  | { kind: "tie"; names: string[] }
  | { kind: "winner"; id: string; name: string };

/** Cómo acabó una partida: nadie sumó, empate entre varios o un ganador. Cada pantalla lo redacta en su idioma. */
export function winnerSummary(players: readonly (Scored & { id: string; name: string })[]): WinnerSummary {
  const top = players[0];
  if (!top || top.score === 0) return { kind: "none" };
  const tied = players.filter((p) => p.score === top.score);
  if (tied.length > 1) return { kind: "tie", names: tied.map((p) => p.name) };
  return { kind: "winner", id: top.id, name: top.name };
}

/** Orden de la paleta de equipos (el de creación), para listar los equipos siempre igual. */
export function byPalette(a: { color: string | null }, b: { color: string | null }): number {
  const order = (color: string | null) => TEAM_COLORS.findIndex((c) => c.key === color);
  return order(a.color) - order(b.color);
}
