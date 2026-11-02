"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DUCK_RAMP_MS, DUCKED_VOLUME, requestPlay } from "@/lib/client/play";
import type { PlayerStatus } from "@/lib/client/spotifyDevice";
import { useFragmentTimer } from "./useFragmentTimer";
import { currentMessages } from "@/i18n/runtime";

/** Espera a que el audio sepa su duración, para poder saltar a un punto concreto. */
function whenSeekable(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
    audio.addEventListener("error", () => reject(new Error(currentMessages().game.player.previewLoadFailed)), { once: true });
  });
}

/**
 * Reproductor del modo abierto: la vista previa de 30 s suena en un `<audio>` del navegador,
 * sin Spotify ni cuenta. Misma interfaz que `useSpotifyPlayer` para que la pantalla no distinga.
 */
export function usePreviewPlayer(enabled = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseAudio = useCallback(() => audioRef.current?.pause(), []);
  const { phase, fragmentMs, remainingMs, start, freeze, thaw, reset, prepare } = useFragmentTimer(pauseAudio);
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
      // El servidor marca la ronda como sonando antes de que cargue el audio: mientras, «arrancando».
      prepare();
      try {
        const res = await requestPlay(gameId, roundId, { offsetMs });
        if (!res.ok) throw new Error(res.data.message ?? currentMessages().game.player.cantPlay);
        if (!res.data.audioUrl) throw new Error(currentMessages().game.player.noPreview);

        const el = audio();
        if (el.src !== res.data.audioUrl) el.src = res.data.audioUrl;
        await whenSeekable(el);
        el.currentTime = offsetMs / 1000;
        try {
          await el.play();
        } catch {
          throw new Error(currentMessages().game.player.audioBlocked);
        }
        start(res.data.fragmentMs, res.data.remainingMs ?? res.data.fragmentMs);
        return res.data;
      } catch (e) {
        reset();
        throw e;
      }
    },
    [audio, prepare, reset, start],
  );

  const pause = useCallback(async () => {
    freeze();
    audioRef.current?.pause();
  }, [freeze]);

  const resume = useCallback(async () => {
    await audioRef.current?.play().catch(() => setError(currentMessages().game.player.audioBlocked));
    thaw();
  }, [thaw]);

  /** Baja (o devuelve) el volumen mientras alguien responde, con una rampa corta para que no sea un golpe. */
  const ramp = useRef<number | null>(null);
  const duck = useCallback(async (on: boolean) => {
    const el = audioRef.current;
    if (!el) return;
    if (ramp.current) cancelAnimationFrame(ramp.current);
    const from = el.volume;
    const to = on ? DUCKED_VOLUME : 1;
    const t0 = performance.now();
    const step = (t: number) => {
      // El primer fotograma puede llevar una marca anterior a `t0`: se acota para no salir de [0, 1].
      const k = Math.min(1, Math.max(0, (t - t0) / DUCK_RAMP_MS));
      el.volume = from + (to - from) * k;
      ramp.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    ramp.current = requestAnimationFrame(step);
  }, []);

  /** Corta el audio y deja el fragmento sin sonar (al cerrar la ronda). */
  const stop = useCallback(async () => {
    reset();
    audioRef.current?.pause();
    if (ramp.current) cancelAnimationFrame(ramp.current);
    // La siguiente pista empieza con el volumen normal aunque esta acabara durante un turno.
    if (audioRef.current) audioRef.current.volume = 1;
  }, [reset]);

  const status: PlayerStatus = enabled ? "ready" : "loading";
  return { status, error, phase, fragmentMs, remainingMs, activate, playFragment, pause, resume, stop, duck };
}
