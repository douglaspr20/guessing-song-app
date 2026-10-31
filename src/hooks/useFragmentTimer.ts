"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Estado del fragmento: sin sonar, arrancando (ya pedido al servidor, esperando al audio), sonando, en pausa o
 * terminado. `starting` no es `idle`: si en ese momento llega el estado de la partida, la ronda no se da por
 * «sin audio» (eso la congelaría en el servidor mientras ya suena).
 */
export type FragmentPhase = "idle" | "starting" | "playing" | "paused" | "ended";

/**
 * Cuenta atrás del fragmento, común a cualquier reproductor: arranca, se pausa, se reanuda
 * y avisa con `onEnd` cuando llega a 0 (para que el reproductor corte el audio).
 */
export function useFragmentTimer(onEnd: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endsAtRef = useRef(0);
  const remainingRef = useRef(0);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  const [phase, setPhase] = useState<FragmentPhase>("idle");
  const [fragmentMs, setFragmentMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    timerRef.current = null;
    tickRef.current = null;
  }, []);

  /** Corre la cuenta atrás con `ms` restantes. */
  const run = useCallback(
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
        onEndRef.current();
      }, ms);
    },
    [clearTimers],
  );

  /** Empieza (o retoma tras recargar) un fragmento de `totalMs` del que quedan `leftMs`. */
  const start = useCallback(
    (totalMs: number, leftMs = totalMs) => {
      setFragmentMs(totalMs);
      run(leftMs);
    },
    [run],
  );

  /** Para la cuenta atrás conservando lo que queda. */
  const freeze = useCallback(() => {
    clearTimers();
    remainingRef.current = Math.max(0, endsAtRef.current - Date.now());
    setRemainingMs(remainingRef.current);
    setPhase("paused");
  }, [clearTimers]);

  /** Sigue desde donde se pausó. */
  const thaw = useCallback(() => run(remainingRef.current), [run]);

  /** Deja el fragmento sin sonar (al cerrar la ronda). */
  const reset = useCallback(() => {
    clearTimers();
    setPhase("idle");
  }, [clearTimers]);

  /** Se ha pedido que suene y se espera al audio: `start` lo pone en marcha, `reset` lo deja si falla. */
  const prepare = useCallback(() => {
    clearTimers();
    setPhase("starting");
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return useMemo(
    () => ({ phase, fragmentMs, remainingMs, start, freeze, thaw, reset, prepare }),
    [phase, fragmentMs, remainingMs, start, freeze, thaw, reset, prepare],
  );
}
