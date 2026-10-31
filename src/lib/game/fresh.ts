import { AppError } from "@/lib/errors";

/**
 * Elige evitando también lo ya oído en otras partidas del mismo dueño; si con esos filtros no queda nada nuevo
 * (Spotify a veces da muy pocas canciones por género), mejor una repetida de otro día que una ronda sin canción.
 * Dentro de la misma partida (`used`) nunca se repite.
 */
export async function pickAvoidingHeard<T>(
  used: ReadonlySet<string>,
  heard: ReadonlySet<string>,
  pick: (exclude: Set<string>) => Promise<T>,
): Promise<T> {
  const fresh = [...heard].filter((id) => !used.has(id));
  if (!fresh.length) return pick(new Set(used));
  try {
    return await pick(new Set([...used, ...fresh]));
  } catch (err) {
    if (!(err instanceof AppError) || err.code !== "NO_TRACKS_FOUND") throw err;
    return pick(new Set(used));
  }
}
