"use client";

import { useEffect, useState } from "react";

/** Reloj de pantalla que avanza cada `intervalMs`. Vale 0 hasta el primer tick (prerender). */
export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Lo que queda de un plazo que el servidor dio como «quedan N ms» al leer el estado (`fetchedAt`).
 * Hasta el primer tick devuelve el valor del servidor tal cual.
 */
export function useRemainingMs(leftAtFetch: number, fetchedAt: number, intervalMs = 200) {
  const now = useNow(intervalMs);
  return remainingMs(leftAtFetch, fetchedAt, now);
}

export function remainingMs(leftAtFetch: number, fetchedAt: number, now: number) {
  return now && fetchedAt ? Math.max(0, leftAtFetch - (now - fetchedAt)) : leftAtFetch;
}
