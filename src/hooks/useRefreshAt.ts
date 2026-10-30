"use client";

import { useEffect } from "react";

/** Vuelve a pedir el estado justo después de `at` (p. ej. cuando el servidor desbloquea la siguiente pista). */
export function useRefreshAt(at: Date | string | null | undefined, refresh: () => Promise<unknown>, delayMs = 0) {
  // La API la manda como texto: la misma hora es el mismo texto y no reprograma el aviso.
  const when = at ? new Date(at).getTime() : null;
  useEffect(() => {
    if (when === null) return;
    const wait = Math.max(0, when - Date.now()) + delayMs;
    const t = setTimeout(() => void refresh().catch(() => {}), wait);
    return () => clearTimeout(t);
  }, [when, refresh, delayMs]);
}
