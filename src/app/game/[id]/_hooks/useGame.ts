"use client";

import { useCallback, useEffect, useState } from "react";
import { useRefreshAt } from "@/hooks/useRefreshAt";
import { api, ApiError, type Game, type GuessRow, errorText } from "@/lib/client/api";
import { HINT_REFRESH_DELAY_MS } from "@/lib/client/hints";

/**
 * Estado de la partida tal como lo ve el servidor: la partida, los intentos de la ronda actual
 * y cuándo se leyeron. También pide de nuevo el estado justo cuando toca la siguiente pista.
 */
export function useGame(gameId: string, onFirstLoad?: (game: Game) => void) {
  const [game, setGame] = useState<Game | null>(null);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState(0);
  /** Por qué no se pudo abrir: la partida no existe (o no es tuya) o falló la conexión. */
  const [loadError, setLoadError] = useState<{ missing: boolean; message: string } | null>(null);

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

  const firstLoad = useCallback(
    () =>
      refresh().then(
        (g) => {
          setLoadError(null);
          onFirstLoad?.(g);
        },
        (e) =>
          setLoadError({
            missing: e instanceof ApiError && e.status === 404,
            message: errorText(e),
          }),
      ),
    // Solo depende de la partida; onFirstLoad no debe relanzar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refresh],
  );

  useEffect(() => {
    // Carga inicial de la partida desde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    firstLoad();
  }, [firstLoad]);

  // La siguiente pista la desbloquea el servidor: se le pregunta justo cuando toca.
  useRefreshAt(game?.round?.nextHintAt, refresh, HINT_REFRESH_DELAY_MS);

  return { game, guesses, fetchedAt, loadError, retryLoad: firstLoad, refresh };
}

