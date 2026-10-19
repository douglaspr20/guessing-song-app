"use client";

import { useEffect, useRef, useState } from "react";
import { useGamePlayer } from "@/hooks/useGamePlayer";
import { rulesFor } from "@/lib/game/scoring";
import { api, type GuessResult, type GuessRow, type Round } from "@/lib/client/api";
import { GAIN_FLASH_MS, INTERMISSION_MS } from "./constants";
import { acceptedFeedback, describeGuess, type Feedback } from "./feedback";
import { deriveRoundClock } from "./roundClock";
import { useGame, useNow } from "./useGame";

export interface Intermission {
  number: number;
  endsAt: number;
}

export interface GuessInput {
  playerId: string;
  title: string;
  artist: string;
}

/**
 * Orquesta una partida en el dispositivo anfitrión: estado del servidor, reproductor, reloj
 * de la ronda y las acciones del anfitrión (empezar, repetir, pausar, revelar, registrar).
 */
export function useGameController(gameId: string) {
  const [showFinale, setShowFinale] = useState(false);
  const { game, guesses, fetchedAt, loadError, refresh } = useGame(gameId, (g) => {
    // Una partida terminada se abre directamente en el podio.
    if (g.status === "FINISHED" && g.round?.status !== "PLAYING") setShowFinale(true);
  });
  // Spotify (SDK) o vista previa de iTunes (<audio>), según el modo de la partida.
  const player = useGamePlayer(game?.mode ?? null);
  const rules = rulesFor(game?.mode);
  const now = useNow();

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [intermission, setIntermission] = useState<Intermission | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [gains, setGains] = useState<Record<string, number>>({});

  const round = game?.round ?? null;
  const clock = deriveRoundClock({
    round,
    fragmentSeconds: game?.fragmentSeconds ?? 0,
    rules,
    fetchedAt,
    now,
    player,
  });

  /** Ejecuta una acción del anfitrión bloqueando los botones y mostrando su error. */
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const flashGain = (playerId: string, points: number) => {
    setGains({ [playerId]: points });
    setTimeout(() => setGains({}), GAIN_FLASH_MS);
  };

  // Al recargar a mitad de una ronda el audio se corta: se pausa el reloj para no perder puntos.
  const roundId = round?.id;
  useEffect(() => {
    if (!clock.needsFreeze || !roundId) return;
    api(`/api/games/${gameId}/rounds/${roundId}/pause`, { method: "POST" })
      .then(() => refresh())
      .catch(() => {});
  }, [clock.needsFreeze, roundId, gameId, refresh]);

  // Next mantiene viva esta pantalla al ir a la estantería (<Activity>) y, al ocultarla, los
  // reproductores cortan el audio. Si estaba sonando, se pausa también el reloj del servidor (para
  // no perder puntos) y al volver con «Seguir jugando» la canción sigue sola desde donde iba.
  const latest = useRef({ gameId, round, player, refresh });
  useEffect(() => {
    latest.current = { gameId, round, player, refresh };
  });
  const pausedOnLeave = useRef<string | null>(null);
  useEffect(() => {
    // Se reanuda en el siguiente turno: al reaparecer, React (en desarrollo) monta, desmonta y vuelve
    // a montar los efectos, y el desmontaje intermedio del reproductor cortaría el audio recién retomado.
    const resumeTimer = pausedOnLeave.current
      ? setTimeout(() => {
          const leftRoundId = pausedOnLeave.current;
          pausedOnLeave.current = null;
          const { gameId, round, player, refresh } = latest.current;
          if (!leftRoundId || round?.id !== leftRoundId || round.status !== "PLAYING" || player.phase !== "paused") return;
          player
            .resume()
            .then(() => api(`/api/games/${gameId}/rounds/${leftRoundId}/resume`, { method: "POST" }))
            .then(() => refresh())
            .catch((e: Error) => setActionError(e.message));
        }, 0)
      : null;
    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      const { gameId, round, player } = latest.current;
      if (player.phase !== "playing" || round?.status !== "PLAYING") return;
      pausedOnLeave.current = round.id;
      void player.pause();
      api(`/api/games/${gameId}/rounds/${round.id}/pause`, { method: "POST" }).catch(() => {});
    };
  }, []);

  // Fin del entreacto: suena la pista.
  useEffect(() => {
    if (!intermission || !roundId) return;
    const t = setTimeout(async () => {
      setIntermission(null);
      try {
        await player.playFragment(gameId, roundId);
        await refresh();
      } catch (e) {
        setActionError((e as Error).message);
      }
    }, Math.max(0, intermission.endsAt - Date.now()));
    return () => clearTimeout(t);
    // Solo depende del entreacto programado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intermission]);

  const startNext = () =>
    run(async () => {
      await player.activate(); // dentro del clic: el audio podrá sonar tras el entreacto
      await player.stop();
      setFeedback(null);
      const r = await api<Round>(`/api/games/${gameId}/rounds`, { method: "POST" });
      await refresh();
      setIntermission({ number: r.number, endsAt: Date.now() + INTERMISSION_MS });
    });

  const replay = () =>
    run(async () => {
      if (!round) return;
      await player.activate();
      await player.playFragment(gameId, round.id);
      await refresh();
    });

  const togglePause = () =>
    run(async () => {
      if (!round) return;
      if (clock.orphan) {
        // Retoma el fragmento donde se quedó; el servidor reanuda el reloj.
        await player.activate();
        await player.playFragment(gameId, round.id, clock.fragmentMs - clock.orphanLeftMs);
      } else if (player.phase === "paused") {
        await player.resume();
        await api(`/api/games/${gameId}/rounds/${round.id}/resume`, { method: "POST" });
      } else {
        await player.pause();
        await api(`/api/games/${gameId}/rounds/${round.id}/pause`, { method: "POST" });
      }
      await refresh();
    });

  const reveal = () =>
    run(async () => {
      if (!round) return;
      await player.stop();
      await api(`/api/games/${gameId}/rounds/${round.id}/reveal`, { method: "POST" });
      await refresh();
    });

  /** Registra una respuesta. Devuelve true si se envió (para limpiar el formulario). */
  const submitGuess = async ({ playerId, title, artist }: GuessInput): Promise<boolean> => {
    if (!round || !game) return false;
    let sent = false;
    await run(async () => {
      const name = game.players.find((p) => p.id === playerId)?.name ?? "";
      const r = await api<GuessResult>(`/api/games/${gameId}/rounds/${round.id}/guesses`, {
        json: { playerId, title: title.trim() || undefined, artist: artist.trim() || undefined },
      });
      sent = true;
      setFeedback(describeGuess(name, r, { title: !!title.trim(), artist: !!artist.trim() }));
      if (r.points) flashGain(playerId, r.points);
      if (r.titleAwarded) await player.stop();
      await refresh();
    });
    return sent;
  };

  /** El anfitrión da por bueno el título o el artista de un intento rechazado. */
  const acceptGuess = (guess: GuessRow, part: "title" | "artist") =>
    run(async () => {
      if (!round) return;
      const r = await api<{ points: number; titleAwarded: boolean }>(
        `/api/games/${gameId}/rounds/${round.id}/guesses/${guess.id}/accept`,
        { json: { [part]: true } },
      );
      setFeedback(acceptedFeedback(guess.playerName, r.points));
      flashGain(guess.playerId, r.points);
      if (r.titleAwarded) await player.stop();
      await refresh();
    });

  return {
    game,
    round,
    guesses,
    loadError,
    player,
    rules,
    clock,
    now,
    busy,
    actionError,
    intermission,
    feedback,
    gains,
    showFinale,
    openFinale: () => setShowFinale(true),
    actions: { startNext, replay, togglePause, reveal, submitGuess, acceptGuess },
  };
}

export type GameController = ReturnType<typeof useGameController>;
