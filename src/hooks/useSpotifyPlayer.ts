"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ensurePlayer, getPlayer, getServerState, getState, reconnect, subscribe } from "@/lib/client/spotifyDevice";

export type { PlayerStatus } from "@/lib/client/spotifyDevice";
/** Estado del fragmento: sin sonar, sonando, en pausa o terminado. */
export type FragmentPhase = "idle" | "playing" | "paused" | "ended";

async function requestPlay(gameId: string, roundId: string, deviceId: string, offsetMs: number) {
  const res = await fetch(`/api/games/${gameId}/rounds/${roundId}/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, offsetMs }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

/**
 * Controla la duración del fragmento sobre el reproductor único de la app.
 * El servidor ordena la reproducción (POST /play); aquí se lleva la cuenta atrás, la pausa y la reanudación.
 */
export function useSpotifyPlayer() {
  const device = useSyncExternalStore(subscribe, getState, getServerState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endsAtRef = useRef(0);
  const remainingRef = useRef(0);

  const [phase, setPhase] = useState<FragmentPhase>("idle");
  const [fragmentMs, setFragmentMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    timerRef.current = null;
    tickRef.current = null;
  }, []);

  /** Arranca la cuenta atrás con `ms` restantes; al llegar a 0 pausa el audio. */
  const runCountdown = useCallback(
    (ms: number) => {
      clearTimers();
      endsAtRef.current = Date.now() + ms;
      remainingRef.current = ms;
      setRemainingMs(ms);
      setPhase("playing");
      tickRef.current = setInterval(() => {
        const left = Math.max(0, endsAtRef.current - Date.now());
        remainingRef.current = left;
        setRemainingMs(left);
      }, 200);
      timerRef.current = setTimeout(() => {
        clearTimers();
        remainingRef.current = 0;
        setRemainingMs(0);
        setPhase("ended");
        void getPlayer()?.pause().catch(() => {});
      }, ms);
    },
    [clearTimers],
  );

  useEffect(() => {
    void ensurePlayer();
    // Al salir de la pantalla (o quedar oculta) se corta el audio; el reproductor sigue vivo.
    return () => {
      clearTimers();
      void getPlayer()?.pause().catch(() => {});
    };
  }, [clearTimers]);

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
      if (!deviceId) throw new Error("El reproductor aún no está listo");
      setError(null);
      clearTimers();
      let res = await requestPlay(gameId, roundId, deviceId, offsetMs);
      // Spotify olvidó el dispositivo (p. ej. tras una reconexión): se registra de nuevo y se reintenta.
      if (res.status === 404 && res.data.error === "SPOTIFY_API_ERROR") {
        deviceId = await reconnect();
        res = await requestPlay(gameId, roundId, deviceId, offsetMs);
      }
      if (!res.ok) throw new Error(res.data.message ?? "No se pudo reproducir");
      setFragmentMs(res.data.fragmentMs);
      runCountdown(res.data.remainingMs ?? res.data.fragmentMs);
      return res.data;
    },
    [clearTimers, runCountdown],
  );

  const pause = useCallback(async () => {
    clearTimers();
    remainingRef.current = Math.max(0, endsAtRef.current - Date.now());
    setRemainingMs(remainingRef.current);
    setPhase("paused");
    await getPlayer()?.pause().catch(() => {});
  }, [clearTimers]);

  const resume = useCallback(async () => {
    await getPlayer()?.resume().catch(() => {});
    runCountdown(remainingRef.current);
  }, [runCountdown]);

  /** Corta el audio y deja el fragmento sin sonar (al cerrar la ronda). */
  const stop = useCallback(async () => {
    clearTimers();
    setPhase("idle");
    await getPlayer()?.pause().catch(() => {});
  }, [clearTimers]);

  return {
    deviceId: device.deviceId,
    status: device.status,
    error: error ?? device.error,
    phase,
    fragmentMs,
    remainingMs,
    activate,
    playFragment,
    pause,
    resume,
    stop,
  };
}
