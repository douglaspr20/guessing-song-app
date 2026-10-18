"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Game, type GuessRow } from "@/lib/client/api";
import { HINT_REFRESH_DELAY_MS } from "./constants";

/**
 * Estado de la partida tal como lo ve el servidor: la partida, los intentos de la ronda actual
 * y cuándo se leyeron. También pide de nuevo el estado justo cuando toca la siguiente pista.
 */
export function useGame(gameId: string, onFirstLoad?: (game: Game) => void) {
  const [game, setGame] = useState<Game | null>(null);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const g = await api<Game>(`/api/games/${gameId}`);
    setGame(g);
    setFetchedAt(Date.now());
    if (g.round) {
      const r = await api<{ guesses: GuessRow[] }>(`/api/games/${gameId}/rounds/${g.round.id}/guesses`);
      setGuesses(r.guesses);
    } else {
      setGuesses([]);
    }
    return g;
  }, [gameId]);

  useEffect(() => {
    // Carga inicial de la partida desde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().then(
      (g) => onFirstLoad?.(g),
      (e) => setLoadError(e instanceof ApiError && e.status === 404 ? "Esta partida no existe." : (e as Error).message),
    );
    // Solo al cargar la partida; onFirstLoad no debe relanzarla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // La siguiente pista la desbloquea el servidor: se le pregunta justo cuando toca.
  const nextHintAt = game?.round?.nextHintAt;
  useEffect(() => {
    if (!nextHintAt) return;
    const wait = Math.max(0, new Date(nextHintAt).getTime() - Date.now()) + HINT_REFRESH_DELAY_MS;
    const t = setTimeout(() => void refresh().catch(() => {}), wait);
    return () => clearTimeout(t);
  }, [nextHintAt, refresh]);

  return { game, guesses, fetchedAt, loadError, refresh };
}

/** Reloj de pantalla que avanza cada `intervalMs`. Vale 0 hasta el primer tick (prerender). */
export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
