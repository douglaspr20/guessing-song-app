"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestPlay } from "@/lib/client/play";
import type { PlayerStatus } from "@/lib/client/spotifyDevice";
import { useFragmentTimer } from "./useFragmentTimer";

/** Espera a que el audio sepa su duración, para poder saltar a un punto concreto. */
function whenSeekable(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
    audio.addEventListener("error", () => reject(new Error("No se pudo cargar la vista previa")), { once: true });
  });
}

/**
 * Reproductor del modo abierto: la vista previa de 30 s suena en un `<audio>` del navegador,
 * sin Spotify ni cuenta. Misma interfaz que `useSpotifyPlayer` para que la pantalla no distinga.
 */
export function usePreviewPlayer(enabled = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseAudio = useCallback(() => audioRef.current?.pause(), []);
  const { phase, fragmentMs, remainingMs, start, freeze, thaw, reset } = useFragmentTimer(pauseAudio);
  const [error, setError] = useState<string | null>(null);

  const audio = useCallback(() => (audioRef.current ??= new Audio()), []);

  // Al salir de la pantalla (o quedar oculta) se corta el audio.
  useEffect(() => {
    if (!enabled) return;
    return pauseAudio;
  }, [enabled, pauseAudio]);

  /** Dentro de un clic: crea el elemento de audio para que el navegador le deje sonar después. */
  const activate = useCallback(async () => {
    audio();
  }, [audio]);

  /** Reproduce la vista previa de la ronda desde el principio, o desde `offsetMs` (tras recargar). */
  const playFragment = useCallback(
    async (gameId: string, roundId: string, offsetMs = 0) => {
      setError(null);
      reset();
      const res = await requestPlay(gameId, roundId, { offsetMs });
      if (!res.ok) throw new Error(res.data.message ?? "No se pudo reproducir");
      if (!res.data.audioUrl) throw new Error("Esta canción no tiene vista previa");

      const el = audio();
      if (el.src !== res.data.audioUrl) el.src = res.data.audioUrl;
      await whenSeekable(el);
      el.currentTime = offsetMs / 1000;
      try {
        await el.play();
      } catch {
        throw new Error("El navegador bloqueó el audio: pulsa Repetir");
      }
      start(res.data.fragmentMs, res.data.remainingMs ?? res.data.fragmentMs);
      return res.data;
    },
    [audio, reset, start],
  );

  const pause = useCallback(async () => {
    freeze();
    audioRef.current?.pause();
  }, [freeze]);

  const resume = useCallback(async () => {
    await audioRef.current?.play().catch(() => setError("El navegador bloqueó el audio: pulsa Repetir"));
    thaw();
  }, [thaw]);

  /** Corta el audio y deja el fragmento sin sonar (al cerrar la ronda). */
  const stop = useCallback(async () => {
    reset();
    audioRef.current?.pause();
  }, [reset]);

  const status: PlayerStatus = enabled ? "ready" : "loading";
  return { status, error, phase, fragmentMs, remainingMs, activate, playFragment, pause, resume, stop };
}
