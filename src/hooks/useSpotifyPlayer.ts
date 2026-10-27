"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { requestPlay } from "@/lib/client/play";
import { ensurePlayer, getPlayer, getServerState, getState, reconnect, subscribe } from "@/lib/client/spotifyDevice";
import { useFragmentTimer } from "./useFragmentTimer";
import { currentMessages } from "@/i18n/runtime";

export type { PlayerStatus } from "@/lib/client/spotifyDevice";
export type { FragmentPhase } from "./useFragmentTimer";

const pauseSpotify = () => void getPlayer()?.pause().catch(() => {});

/**
 * Reproductor del modo Spotify: el servidor ordena sonar al Web Playback SDK (POST /play) y aquí
 * se lleva la cuenta atrás, la pausa y la reanudación. Con `enabled` en false no carga el SDK.
 */
export function useSpotifyPlayer(enabled = true) {
  const device = useSyncExternalStore(subscribe, getState, getServerState);
  const timer = useFragmentTimer(pauseSpotify);
  const { start, freeze, thaw, reset } = timer; // estables: no cambian con cada tick
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void ensurePlayer();
    // Al salir de la pantalla (o quedar oculta) se corta el audio; el reproductor sigue vivo.
    return pauseSpotify;
  }, [enabled]);

  /** Desbloquea el audio del navegador. Llamar dentro de un clic, aunque el audio suene después. */
  const activate = useCallback(async () => {
    await getPlayer()?.activateElement().catch(() => {});
  }, []);

  /**
   * Reproduce el fragmento de la ronda desde el principio, o desde `offsetMs`
   * para retomarlo a medias (al volver tras recargar la página).
   */
  const playFragment = useCallback(
    async (gameId: string, roundId: string, offsetMs = 0) => {
      let deviceId = getState().deviceId;
      if (!deviceId) throw new Error(currentMessages().game.player.notReady);
      setError(null);
      reset();
      let res = await requestPlay(gameId, roundId, { deviceId, offsetMs });
      // Spotify olvidó el dispositivo (p. ej. tras una reconexión): se registra de nuevo y se reintenta.
      if (res.status === 404 && res.data.error === "SPOTIFY_API_ERROR") {
        deviceId = await reconnect();
        res = await requestPlay(gameId, roundId, { deviceId, offsetMs });
      }
      if (!res.ok) throw new Error(res.data.message ?? currentMessages().game.player.cantPlay);
      start(res.data.fragmentMs, res.data.remainingMs ?? res.data.fragmentMs);
      return res.data;
    },
    [reset, start],
  );

  const pause = useCallback(async () => {
    freeze();
    await getPlayer()?.pause().catch(() => {});
  }, [freeze]);

  const resume = useCallback(async () => {
    await getPlayer()?.resume().catch(() => {});
    thaw();
  }, [thaw]);

  /** Corta el audio y deja el fragmento sin sonar (al cerrar la ronda). */
  const stop = useCallback(async () => {
    reset();
    await getPlayer()?.pause().catch(() => {});
  }, [reset]);

  return {
    status: device.status,
    error: error ?? device.error,
    phase: timer.phase,
    fragmentMs: timer.fragmentMs,
    remainingMs: timer.remainingMs,
    activate,
    playFragment,
    pause,
    resume,
    stop,
  };
}
