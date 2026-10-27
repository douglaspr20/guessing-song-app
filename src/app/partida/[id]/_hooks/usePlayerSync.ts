"use client";

import { useEffect, useRef } from "react";
import type { useGamePlayer } from "@/hooks/useGamePlayer";
import { api, type Round } from "@/lib/client/api";
import { BUZZ_EXPIRE_DELAY_MS } from "../_lib/constants";
import type { RoundClockView } from "../_lib/roundClock";

export interface Intermission {
  number: number;
  endsAt: number;
}

interface PlayerSync {
  gameId: string;
  round: Round | null;
  /** Cuándo se leyó el estado (el tiempo del turno se mide desde ahí). */
  fetchedAt: number;
  player: ReturnType<typeof useGamePlayer>;
  clock: RoundClockView;
  intermission: Intermission | null;
  endIntermission: () => void;
  refresh: () => Promise<unknown>;
  readState: () => Promise<void>;
  onError: (message: string) => void;
}

/**
 * Mantiene el audio de la tele de acuerdo con la partida:
 * - pausa al pulsar alguien «¡Lo sé!» y sigue sola si su turno acaba sin ganar;
 * - cierra el turno si el móvil de quien pulsó no responde;
 * - congela el reloj si se recarga a mitad de ronda (sin audio);
 * - pausa al salir de la pantalla y sigue al volver;
 * - hace sonar la pista al acabar el entreacto.
 */
export function usePlayerSync({ gameId, round, fetchedAt, player, clock, intermission, endIntermission, refresh, readState, onError }: PlayerSync) {
  const roundId = round?.id;
  const buzz = round?.status === "PLAYING" ? (round.buzz ?? null) : null;

  // Alguien pulsa: la música se para; acaba su turno sin ganar: sigue sola. Si la ronda se cierra, se corta.
  const pausedByBuzz = useRef<string | null>(null);
  const buzzId = buzz?.participantId ?? null;
  const roundStatus = round?.status;
  const roundPaused = round?.paused;
  useEffect(() => {
    if (!roundId) return;
    if (roundStatus === "PLAYING" && buzzId) {
      if (player.phase === "playing") {
        pausedByBuzz.current = roundId;
        void player.pause();
      }
      return;
    }
    if (pausedByBuzz.current === roundId) {
      pausedByBuzz.current = null;
      if (roundStatus === "PLAYING" && !roundPaused && player.phase === "paused") {
        player.resume().catch((e: Error) => onError(e.message));
      }
    }
    if (roundStatus && roundStatus !== "PLAYING" && (player.phase === "playing" || player.phase === "paused")) {
      void player.stop();
    }
    // `player` cambia en cada render: solo importan su fase y lo que dice el servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buzzId, roundId, roundStatus, roundPaused, player.phase]);

  // Si el móvil de quien pulsó no responde, la tele cierra su turno poco después de acabarse el tiempo.
  const buzzMsAtFetch = buzz?.remainingMs ?? 0;
  useEffect(() => {
    if (!buzzId || !roundId) return;
    const wait = Math.max(0, buzzMsAtFetch - (Date.now() - fetchedAt)) + BUZZ_EXPIRE_DELAY_MS;
    const t = setTimeout(() => {
      api(`/api/games/${gameId}/rounds/${roundId}/buzz`, { json: { mode: "expire" } })
        .catch(() => {})
        .finally(readState);
    }, wait);
    return () => clearTimeout(t);
    // Un turno nuevo (otra persona o ronda) reprograma el cierre; leer otra vez el mismo no.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buzzId, roundId]);

  // Al recargar a mitad de una ronda el audio se corta: se pausa el reloj para no perder puntos.
  useEffect(() => {
    if (!clock.needsFreeze || !roundId) return;
    api(`/api/games/${gameId}/rounds/${roundId}/pause`, { method: "POST" })
      .then(() => refresh())
      .catch(() => {});
  }, [clock.needsFreeze, roundId, gameId, refresh]);

  // Next mantiene viva esta pantalla al ir a la estantería (<Activity>) y, al ocultarla, los
  // reproductores cortan el audio. Si estaba sonando, se pausa también el reloj del servidor (para
  // no perder puntos) y al volver con «Seguir jugando» la canción sigue sola desde donde iba.
  const latest = useRef({ gameId, round, player, refresh, onError });
  useEffect(() => {
    latest.current = { gameId, round, player, refresh, onError };
  });
  const pausedOnLeave = useRef<string | null>(null);
  useEffect(() => {
    // Se reanuda en el siguiente turno: al reaparecer, React (en desarrollo) monta, desmonta y vuelve
    // a montar los efectos, y el desmontaje intermedio del reproductor cortaría el audio recién retomado.
    const resumeTimer = pausedOnLeave.current
      ? setTimeout(() => {
          const leftRoundId = pausedOnLeave.current;
          pausedOnLeave.current = null;
          const { gameId, round, player, refresh, onError } = latest.current;
          if (!leftRoundId || round?.id !== leftRoundId || round.status !== "PLAYING" || player.phase !== "paused") return;
          player
            .resume()
            .then(() => api(`/api/games/${gameId}/rounds/${leftRoundId}/resume`, { method: "POST" }))
            .then(() => refresh())
            .catch((e: Error) => onError(e.message));
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
      endIntermission();
      try {
        await player.playFragment(gameId, roundId);
        await refresh();
      } catch (e) {
        onError((e as Error).message);
      }
    }, Math.max(0, intermission.endsAt - Date.now()));
    return () => clearTimeout(t);
    // Solo depende del entreacto programado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intermission]);
}
